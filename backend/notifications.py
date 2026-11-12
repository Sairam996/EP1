"""Push (Emergent) + Email (Resend) notification helpers for Thara."""
import os
import logging
import httpx

logger = logging.getLogger("eventpro.notify")

# ── Push (Emergent-managed) ──────────────────────────────────────────────────
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
_push_client = httpx.AsyncClient(base_url=PUSH_BASE_URL, headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)

async def register_device(user_id: str, platform: str, device_token: str) -> None:
    """Register a device token so the user can receive pushes."""
    if PUSH_KEY == "placeholder":
        logger.info(f"[PUSH mock] register user={user_id} platform={platform} token={device_token[:20]}…")
        return
    try:
        resp = await _push_client.post("/api/v1/push/users/register",
            json={"user_id": user_id, "platform": platform, "device_token": device_token})
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"Push register failed (non-blocking): {e}")

async def send_push(recipients: list, title: str, message: str, action_url: str = None,
                    idempotency_key: str = None) -> None:
    """Fire-and-forget push to one or more user_ids. Never raises."""
    if not recipients:
        return
    if PUSH_KEY == "placeholder":
        logger.info(f"[PUSH mock] to={recipients} title={title!r} msg={message!r}")
        return
    data = {"title": title, "message": message}
    if action_url:
        data["action_url"] = action_url
    payload = {"recipients": recipients[:100], "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    try:
        r = await _push_client.post("/api/v1/push/trigger", json=payload)
        if r.status_code >= 400:
            logger.warning(f"Push trigger {r.status_code}: {r.text[:200]}")
    except Exception as e:
        logger.warning(f"Push send failed (non-blocking): {e}")

# ── Email (Resend) ───────────────────────────────────────────────────────────
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "Thara <onboarding@resend.dev>")
APP_NAME = os.environ.get("APP_NAME", "Thara")

_BRAND = "#D4AF37"
def _wrap(inner_html: str, preview: str = "") -> str:
    return f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0B0C10;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#F3F4F6">
<div style="display:none">{preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0C10;padding:40px 16px">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0"
      style="background:#1A1D24;border:1px solid #262A33;border-radius:16px;max-width:560px;width:100%">
      <tr><td style="padding:28px 32px 8px 32px">
        <div style="color:{_BRAND};font-size:26px;font-weight:300;letter-spacing:5px">Thara</div>
        <div style="height:1px;width:48px;background:{_BRAND};opacity:0.5;margin-top:8px"></div>
      </td></tr>
      <tr><td style="padding:20px 32px 32px 32px;line-height:1.55;font-size:14px;color:#F3F4F6">{inner_html}</td></tr>
      <tr><td style="padding:16px 32px 28px 32px;border-top:1px solid #262A33;color:#A1A1AA;font-size:11px;line-height:1.6">
        You're receiving this because you're an {APP_NAME} member.<br>
        India's premium marketplace for weddings, sangeet, birthdays &amp; corporate events.
      </td></tr>
    </table>
  </td></tr>
</table></body></html>"""

async def send_email(to: str, subject: str, html: str, preview: str = "") -> None:
    """Send an email via Resend. Never raises — logs failures."""
    if not to:
        return
    body = _wrap(html, preview)
    if not RESEND_API_KEY:
        logger.info(f"[EMAIL mock] to={to} subject={subject!r}")
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.post("https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                json={"from": EMAIL_FROM, "to": [to], "subject": subject, "html": body})
            if r.status_code >= 400:
                logger.warning(f"Resend {r.status_code}: {r.text[:200]}")
    except Exception as e:
        logger.warning(f"Email send failed (non-blocking): {e}")

# ── Ready-made templates ─────────────────────────────────────────────────────
def tpl_welcome(name: str) -> tuple:
    return (f"Welcome to {APP_NAME}, {name.split()[0]}!",
        f"<h2 style='color:#F3F4F6;margin:0 0 12px'>Namaste {name.split()[0]} 🙏</h2>"
        f"<p>We're thrilled to have you on {APP_NAME}. Discover verified venues, catering, décor, photography and more — curated for premium Indian events.</p>"
        f"<p style='margin-top:20px'><a href='#' style='background:{_BRAND};color:#0B0C10;padding:11px 22px;border-radius:10px;text-decoration:none;font-weight:600'>Start exploring</a></p>",
        "Welcome to India's premium event marketplace.")

def tpl_login_alert(name: str) -> tuple:
    return (f"New sign-in to your {APP_NAME} account",
        f"<h2 style='color:#F3F4F6;margin:0 0 12px'>Hi {name.split()[0]},</h2>"
        f"<p>We noticed a new sign-in to your {APP_NAME} account. If this was you, no action is needed.</p>"
        f"<p style='color:#A1A1AA;font-size:12px'>If you didn't sign in, please reset your password immediately.</p>",
        "New sign-in on your account.")

def tpl_booking_created_customer(name: str, vendor: str, event_type: str, date: str, amount: int) -> tuple:
    return (f"Booking request sent to {vendor}",
        f"<h2 style='color:#F3F4F6;margin:0 0 12px'>Booking submitted 🎉</h2>"
        f"<p>Hi {name.split()[0]}, your booking request has been sent to <b>{vendor}</b>. They'll respond shortly. After they accept, a 20% advance locks the date; the balance is due on the event day.</p>"
        f"<table cellpadding='8' style='margin-top:14px;background:#0B0C10;border-radius:10px;border:1px solid #262A33;width:100%'>"
        f"<tr><td style='color:#A1A1AA'>Event</td><td style='color:#F3F4F6'>{event_type.title()}</td></tr>"
        f"<tr><td style='color:#A1A1AA'>Date</td><td style='color:#F3F4F6'>{date}</td></tr>"
        f"<tr><td style='color:#A1A1AA'>Total (incl. GST)</td><td style='color:{_BRAND};font-weight:600'>₹{amount:,}</td></tr></table>",
        f"Booking with {vendor} on {date}.")

def tpl_booking_new_vendor(vendor_name: str, customer: str, event_type: str, date: str, amount: int) -> tuple:
    return (f"New inquiry — {customer}, {date}",
        f"<h2 style='color:#F3F4F6;margin:0 0 12px'>New booking inquiry ✨</h2>"
        f"<p>Hi {vendor_name.split()[0]}, <b>{customer}</b> has requested a booking for a {event_type} on <b>{date}</b>.</p>"
        f"<p style='color:{_BRAND};font-weight:600;font-size:16px'>Total (incl. GST): ₹{amount:,}</p>"
        f"<p>A 20% advance after you accept locks the date. The balance is due on the event day.</p>"
        f"<p>Open the {APP_NAME} vendor dashboard to accept or decline.</p>",
        f"{customer} wants to book you.")

def tpl_booking_status(name: str, vendor: str, status: str, date: str,
                       advance: int | None = None, balance: int | None = None) -> tuple:
    icon = "🎉" if status == "confirmed" else "😔" if status == "rejected" else "✅"
    verb = {"confirmed": "accepted", "rejected": "declined", "completed": "marked as completed"}.get(status, status)
    extra = ""
    if status == "confirmed" and advance is not None:
        extra = (f"<p>Pay a 20% advance of <b style='color:{_BRAND}'>₹{advance:,}</b> to lock your date. "
                 f"The balance of ₹{(balance or 0):,} is due on {date}, in the app or directly to the vendor.</p>")
    elif status == "confirmed":
        extra = "<p>Pay a 20% advance in the app to lock your date. The balance is due on the event day.</p>"
    elif status == "rejected":
        extra = f"<p>Don't worry — plenty more premium vendors on {APP_NAME}.</p>"
    elif status == "completed":
        extra = "<p>Loved the experience? Leave them a review.</p>"
    return (f"Your booking is {verb}",
        f"<h2 style='color:#F3F4F6;margin:0 0 12px'>{icon} Booking {verb}</h2>"
        f"<p>Hi {name.split()[0]}, <b>{vendor}</b> has {verb} your booking for {date}.</p>" + extra,
        f"Your booking is {verb}.")

def tpl_payment_receipt(name: str, vendor: str, amount: int, earned: int, kind: str = "advance") -> tuple:
    label = "Advance payment" if kind == "advance" else "Balance payment"
    subject = f"{'Advance' if kind == 'advance' else 'Balance'} receipt — ₹{amount:,}"
    tail = (" The remaining balance is due on the event date, in the app or directly to the vendor."
            if kind == "advance" else " Your booking is fully settled.")
    return (subject,
        f"<h2 style='color:#F3F4F6;margin:0 0 12px'>{label} received ✓</h2>"
        f"<p>Hi {name.split()[0]}, your {label.lower()} of <b style='color:{_BRAND}'>₹{amount:,}</b> to {vendor} is confirmed.{tail}</p>"
        + (f"<p style='color:{_BRAND}'>🎁 You earned <b>+{earned} Thara Points</b> on this payment.</p>" if earned else ""),
        f"Paid ₹{amount:,} to {vendor}.")

def tpl_review_received(vendor_name: str, reviewer: str, rating: int, comment: str) -> tuple:
    stars = "★" * rating + "☆" * (5 - rating)
    return (f"{reviewer} left you a {rating}-star review",
        f"<h2 style='color:#F3F4F6;margin:0 0 12px'>New review ⭐</h2>"
        f"<p>Hi {vendor_name.split()[0]}, <b>{reviewer}</b> has reviewed your services.</p>"
        f"<p style='color:{_BRAND};font-size:20px;letter-spacing:2px'>{stars}</p>"
        + (f"<blockquote style='border-left:3px solid {_BRAND};padding:8px 14px;color:#D1D5DB;font-style:italic'>{comment}</blockquote>" if comment else ""),
        f"{reviewer}: {rating}★")
