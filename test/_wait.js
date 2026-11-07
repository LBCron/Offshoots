// Waiting for the page instead of waiting a while.
//
// The suite used to be 221 hardcoded sleeps totalling 153 seconds: "a click, then probably
// 700ms is enough". That is wrong in both directions at once. On an idle machine almost
// every one of them is far longer than the thing it waits for, which is why a full run took
// two and a half minutes of which eighteen seconds was CPU. Under load some of them are too
// short, which is where the suite's flakiness came from: a check that fails one run in five
// is not finding a bug, it is reporting that the stopwatch lost a race.
//
// So: say what you are waiting for.
//
//   settle(p)              the page has stopped changing — no DOM mutations and no running
//                          transitions or animations for a moment. The honest replacement
//                          for "wait for the sheet to finish opening", and the one to reach
//                          for when the thing being waited on has no name.
//   until(p, fn, arg)      this predicate is true in the page.
//   gone(p, sel)           that element is no longer there, or no longer displayed.
//
// All three return as soon as the condition holds, and all three give up after a cap rather
// than hanging: a test that waits forever tells you nothing, while one that gives up and
// then fails its own assertion tells you exactly what did not happen.

// How long a condition may take before we stop waiting. Generous, because the cap is a
// backstop and not a timing assertion — nothing reaches it on a healthy run.
const CAP = 10000;

// Quiet for this long counts as settled. Long enough to span the gap between a class
// landing and the transition it starts; short enough that a settled page costs ~100ms
// rather than the 400-800ms the sleeps charged.
const IDLE = 110;

// A wait that ran out is a wait for something that never happened, and it costs the full
// cap every time: the xplay suite spent six minutes of a six-minute run waiting for a
// sheet to open on a page that opens with it shut by design, and passed anyway. So every
// cap hit says so, as a note (no verdict), with the line in the suite that asked for it.
// The runner counts these lines per suite, so a dead wait is visible in the summary
// instead of hidden inside a long but green run.
function overran(kind, cap){
  const at=(new Error().stack.split("\n").find(l=>/\.test\.js:\d+/.test(l) && !/_wait\.js/.test(l))||"")
    .replace(/^\s*at\s+/,"").replace(/.*\//,"").replace(/\)$/,"");
  console.log("     wait: "+kind+" ran to its "+cap+"ms cap at "+at);
}

async function settle(p, opts){
  const idle = (opts && opts.idle) || IDLE;
  const cap  = (opts && opts.cap)  || CAP;
  const t0 = Date.now();
  // Restart this call's clock. The cap is a per-call backstop, and it used to be stamped
  // when the observer was installed instead — so on a page that lives for the whole file,
  // every settle() after the first ten seconds returned instantly and waited for nothing.
  // Silent, too: the waits looked present and did nothing. Per call, not per page.
  try{ await p.evaluate(()=>{ if(window.__settleState) window.__settleState.t0=performance.now(); }); }
  catch(e){}
  try{
    await p.waitForFunction(({idle,cap})=>{
      // One observer per page, installed on first use and left running: it records when
      // the DOM last changed, and the predicate below is then a cheap comparison rather
      // than a fresh observer every poll.
      if(!window.__settleState){
        const st = {last: performance.now(), t0: performance.now()};
        st.mo = new MutationObserver(()=>{ st.last = performance.now(); });
        st.mo.observe(document.documentElement,
          {childList:true, subtree:true, attributes:true, characterData:true});
        window.__settleState = st;
      }
      const st = window.__settleState, now = performance.now();
      if(now - st.t0 > cap) return true;              // backstop, let the assertion speak
      if(now - st.last < idle) return false;          // something changed just now
      // A transition that has started but not finished is a change still in flight, even
      // though it mutates nothing: the sheet slides, the circle scales, the page pushes.
      if(typeof document.getAnimations === "function"){
        const running = document.getAnimations().some(a=>a.playState === "running");
        if(running) return false;
      }
      return true;
    }, {idle, cap}, {timeout: cap + 1000, polling: 40});
  }catch(e){ /* the assertion that follows is the one that should fail, not this */ }
  if(Date.now()-t0 >= cap) overran("settle", cap);
  // one frame, so anything scheduled for the next paint has run before we measure
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>r())));
}

// Reset between navigations: a fresh document has no observer, and a stale `last` from the
// previous one would make the first settle() return early.
async function arm(p){
  // Disconnect before dropping it: a navigation throws the old document away, but an arm()
  // on a live page would otherwise leave the observer running and add another beside it.
  try{ await p.evaluate(()=>{
    if(window.__settleState && window.__settleState.mo) window.__settleState.mo.disconnect();
    delete window.__settleState;
  }); }catch(e){}
}

async function until(p, fn, arg, cap){
  try{ await p.waitForFunction(fn, arg, {timeout: cap || CAP, polling: 40}); return true; }
  catch(e){ if(/Timeout|timeout/.test(String(e))) overran("until", cap || CAP); return false; }
}

async function gone(p, sel, cap){
  return until(p, s=>{
    const e = document.querySelector(s);
    return !e || e.hidden || getComputedStyle(e).display === "none" || !e.getClientRects().length;
  }, sel, cap);
}

// There when it is there, rather than there after 800ms.
async function shown(p, sel, cap){
  return until(p, s=>{
    const e = document.querySelector(s);
    return !!e && !e.hidden && !!e.getClientRects().length;
  }, sel, cap);
}

// The app opens on Explore rather than on a peek of it, so the grabber is a toggle whose
// resting state changed under every test that used it to open the sheet: a bare tap now
// closes what it used to open, and the wait for body.open that follows hangs until the
// cap. This taps only when the sheet is shut, which is what every one of those call sites
// meant in the first place.
async function raise(page){
  const shut = await page.evaluate(()=>!document.body.classList.contains("open"));
  if(shut) await page.click("#grab").catch(()=>{});
  return shut;
}

// Its opposite, for the call sites that tapped the grabber meaning close. Rewriting every
// tap as raise() turned those into no-ops, which is worse than the breakage it fixed: a
// check that asks whether the sheet is shut after a tap that never happened still reads
// like a check.
async function lower(page){
  const open = await page.evaluate(()=>document.body.classList.contains("open"));
  if(open) await page.click("#grab").catch(()=>{});
  return open;
}

module.exports = {settle, until, gone, shown, arm, raise, lower, CAP, IDLE};
