/** One-shot gate so cold start plays the launch intro once per JS session. */
let pending = true;

export function shouldPlayLaunchIntro(): boolean {
  return pending;
}

export function consumeLaunchIntro(): boolean {
  if (!pending) return false;
  pending = false;
  return true;
}

export function resetLaunchIntroForTests() {
  pending = true;
}
