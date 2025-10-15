// ============================
// Configurable navigation
// ============================
const NEXT_PAGE = "07_prePracticeWait.html";   // where to go after finishing the quiz

// Preserve selected query params
function parseQuery() {
  const q = new URLSearchParams(location.search);
  return Object.fromEntries(q.entries());
}
function baseQueryString() {
  const { p, n, m } = parseQuery();
  const q = new URLSearchParams();
  if (p) q.set("p", p);
  if (n) q.set("n", n);
  q.set("m", (m === "1" ? "1" : "0"));
  return "?" + q.toString();
}

// ============================
// Full quiz content (G1–G6)
// ============================
const QUIZ = (() => {
  // Helper to wrap guideline content as HTML blocks
  const gTitle = (n, of, text) =>
    `<strong><span style="font-size:24px;">Guideline ${n} of ${of}: ${text}</span></strong>`;
  const p = (t) => `<p>${t}</p>`;
  const stim = (src) => src;

  const G = [];

  // --- G1 ---
  G.push({
    titleHtml: gTitle(1, 6, "Draw what you see across your field of view"),
    bodyHtml:
      p("Imagine you could take a picture of your whole visual field. Don't select only certain things to draw or move things around.")
      + p("Imagine you saw this triangle on the upper left with a diamond below it:"),
    stimulusSrc: stim("https://universityofsussex.eu.qualtrics.com/CP/Graphic.php?IM=IM_mdVkaaP3iA0waVE"),
    questions: [
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_fVsylhlmtUGn1LM",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_N2Y3D25t0vflWas",
        msgCorrect:  "That’s right, try to draw everything in its place.",
        msgIncorrect:"Not quite - you should draw everything where you saw it, don’t move something from the corner to the centre or vice versa.",
        correctSide: "left"
      },
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_fVsylhlmtUGn1LM",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_SHJbdoGx0v3UhXG",
        msgCorrect:  "That’s right, try not to leave things out.",
        msgIncorrect:"Not quite - try to draw everything you see, as much as you can.",
        correctSide: "right"
      }
    ]
  });

  // --- G2 ---
  G.push({
    titleHtml: gTitle(2, 6, "Draw what you see at one point in time"),
    bodyHtml:
      p("You may see various things over time, just pick one and draw that")
      + p("Imagine you saw this - a line and then an oval:"),
    stimulusSrc: stim("https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_YnWoPkG4isEUGAm"),
    questions: [
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_HwrptbGuDi88bE1",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_QoRZTc8LxShTf0u",
        msgCorrect:  "Correct, just drawing the line is a great choice.",
        msgIncorrect:"Not quite, you don't want to combine different things you saw over time. Instead, you should just pick one moment to draw.",
        correctSide: "left"
      },
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_tPdPqm2n52GppDT",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_s5eYW54xZmfrzuN",
        msgCorrect:  "Correct, just drawing the oval is a great choice.",
        msgIncorrect:"Not quite, you don't want to combine different things you saw over time. Instead, you should just pick one moment to draw.",
        correctSide: "right"
      }
    ]
  });

  // --- G3 ---
  G.push({
    titleHtml: gTitle(3, 6, "Draw what you see at one point in time, and pick what you see most often."),
    bodyHtml:
      p("If you see a few different things over time, pick a moment that you remember best which represents the rest of that trial well.")
      + p("Imagine you saw this, mostly squares, but also some circles"),
    stimulusSrc: stim("https://universityofsussex.eu.qualtrics.com/CP/Graphic.php?IM=IM_jnyauSgc3SqMAPC"),
    questions: [
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_kL1IIMw3EXqocAZ",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_KxyOqfmQtvfSrbY",
        msgCorrect:  "That’s right! It's better to draw a memory of a square because that better represents the whole experience.",
        msgIncorrect:"Close - it would be OK to draw the circle because you did see a circle like that. But it's better to draw what you saw most often, like the square.",
        correctSide: "right"
      }
    ]
  });

  // --- G4 ---
  G.push({
    titleHtml: gTitle(4, 6, "Draw what you really saw"),
    bodyHtml:
      p("Try to draw what you saw, as you saw it, simplifying it as little as possible.")
      + p("Imagine you saw this square:"),
    stimulusSrc: stim("https://universityofsussex.eu.qualtrics.com/CP/Graphic.php?IM=IM_9SvVX2Q9tU4c7Tv"),
    questions: [
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_t1cd8UYGPtjMtmu",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_2FLGbxvzSH9CNxF",
        msgCorrect:  "Correct. Don’t write or conceptualize what you saw with symbols, diagrams, text, or arrows.",
        msgIncorrect:"Not quite - don’t write down what you saw or use arrows. Try to just draw it as you saw it.",
        correctSide: "left"
      },
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_t1cd8UYGPtjMtmu",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_rXaMaGjzwQSRC92",
        msgCorrect:  "Correct. Try to draw the image with the shades you really saw.",
        msgIncorrect:"Not quite. In this example, you saw a white square on a black background, not a black square on a white background. Try not to flip things or change the shades of what you saw.",
        correctSide: "right"
      },
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_t1cd8UYGPtjMtmu",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_xRqZxc7Y7F9dtYe",
        msgCorrect:  "Correct. Don’t draw outlines unless you really saw outlines.",
        msgIncorrect:"Not quite, in this example you saw a filled in square, not one in outlines.",
        correctSide: "right"
      },
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_t1cd8UYGPtjMtmu",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_xeByuhovQDMaPZ3",
        msgCorrect:  "Correct. Draw what you saw, not what you were thinking of or imagining.",
        msgIncorrect:"Not quite, try to draw what you literally saw, not what you were thinking of or imagining. ",
        correctSide: "left"
      }
    ]
  });

  // --- G5 ---
  G.push({
    titleHtml: gTitle(5, 6, "Always draw something."),
    bodyHtml:
      p("Even if you saw almost nothing.")
      + p("Imagine you saw this:"),
    stimulusSrc: stim("https://universityofsussex.eu.qualtrics.com/CP/Graphic.php?IM=IM_OudPoa3TOMdUaJT"),
    questions: [
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_duwPtqZaMgVItmW",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_6HmeTfA1tGG5Ymm",
        msgCorrect:  "Correct. Try to draw something in every trial. If you saw barely anything at all, you might not need to draw much, but don’t draw nothing.",
        msgIncorrect:"Not quite, try to draw something in every trial.",
        correctSide: "left"
      }
    ]
  });

  // --- G6 (both answers correct) ---
  G.push({
    titleHtml: gTitle(6, 6, "Don’t worry about it, just try your best!"),
    bodyHtml:
      p("We don’t expect you to be an artist, just try your best in each trial.")
      + p("Imagine you saw this:"),
    stimulusSrc: stim("https://universityofsussex.eu.qualtrics.com/CP/Graphic.php?IM=IM_SzIPoKeIJTtNLzb"),
    questions: [
      {
        correctImg: "https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_QHYZxsDa1OqkLln",
        incorrectImg:"https://universityofsussex.eu.qualtrics.com/ControlPanel/Graphic.php?IM=IM_XI6kq8FTTwMtbeL",
        bothCorrect: true,
        correctSide: "left",
        msgBothCorrect: "Trick question. Either is fine, just as long as you try your hardest!"
      }
    ]
  });

  // Flatten into a single question list with guideline metadata
  const flat = [];
  G.forEach((g, gIdx) => {
    g.questions.forEach(q => flat.push({
      gIndex: gIdx,
      titleHtml: g.titleHtml,
      bodyHtml: g.bodyHtml,
      stimulusSrc: g.stimulusSrc,
      ...q
    }));
  });

  return { groups: G, questions: flat };
})();

// ============================
// Runtime state & wiring
// ============================
(function initQuiz(){
  const imgLeft  = document.getElementById("xImgLeft");
  const imgRight = document.getElementById("xImgRight");
  const msgBox   = document.getElementById("xMessageBox");
  const btnBack  = document.getElementById("xBackButton");
  const btnNext  = document.getElementById("xNextButton");
  const qCounter = document.getElementById("xQuestionCounter");
  const gTitle   = document.getElementById("xGuidelineTitle");
  const gText    = document.getElementById("xGuidelineText");
  const stimImg  = document.getElementById("xStimulusImg");

  [imgLeft, imgRight].forEach(el => {
    el.setAttribute("draggable", "false");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.style.userSelect = "none";
  });

  const N = QUIZ.questions.length;
  if (N === 0) return;

  // Stable randomization only for items explicitly marked random
  const key = "guidelinesQuiz::randLeft";
  let randLeft = null;
  try { randLeft = JSON.parse(sessionStorage.getItem(key)); } catch (_){}
  if (!Array.isArray(randLeft) || randLeft.length !== N) {
    randLeft = Array.from({ length: N }, () => Math.random() < 0.5);
    try { sessionStorage.setItem(key, JSON.stringify(randLeft)); } catch (_){}
  }

  const answeredCorrect = Array.from({ length: N }, () => false);
  const chosenSide      = Array.from({ length: N }, () => null); // 'left'|'right'|null
  let idx = 0;

  function clearBorders() {
    imgLeft.style.borderColor = "transparent";
    imgRight.style.borderColor = "transparent";
  }
  function setBorder(el, color) {
    el.style.borderColor = color;
  }
  function leftIsCorrectFor(i) {
    const q = QUIZ.questions[i];
    const side = (q.correctSide || "random").toLowerCase();
    if (side === "left")  return true;
    if (side === "right") return false;
    return !!randLeft[i];
  }
  function currentIsBothCorrect() {
    return !!QUIZ.questions[idx].bothCorrect;
  }

  function paintQuestion() {
    const q = QUIZ.questions[idx];
    const qNum = idx + 1;

    // Header + counter
    gTitle.innerHTML = q.titleHtml;
    qCounter.textContent = `Question ${qNum} of ${N}`;

    // Guideline body + stimulus
    gText.innerHTML = q.bodyHtml;
    stimImg.src = q.stimulusSrc;

    // Choices
    const leftIsCorrect = leftIsCorrectFor(idx);
    const bothOk = currentIsBothCorrect();

    if (leftIsCorrect) {
      imgLeft.src  = q.correctImg;
      imgRight.src = q.incorrectImg;
      imgLeft.dataset.correct  = "true";
      imgRight.dataset.correct = bothOk ? "true" : "false"; // both correct -> mark true
    } else {
      imgLeft.src  = q.incorrectImg;
      imgRight.src = q.correctImg;
      imgLeft.dataset.correct  = bothOk ? "true" : "false";
      imgRight.dataset.correct = "true";
    }

    // Reset visuals/message
    clearBorders();
    msgBox.textContent = "";

    // Restore state if already answered
    if (answeredCorrect[idx]) {
      const lOK = (imgLeft.dataset.correct === "true");
      const rOK = (imgRight.dataset.correct === "true");
      // paint borders based on correctness & choice
      if (lOK) setBorder(imgLeft,  "#10b981");
      if (rOK) setBorder(imgRight, "#10b981");
      if (!lOK) setBorder(imgLeft,  "#ef4444");
      if (!rOK) setBorder(imgRight, "#ef4444");

      if (bothOk) {
        msgBox.textContent = q.msgBothCorrect || "Either choice is acceptable.";
      } else {
        msgBox.textContent = (chosenSide[idx] === (leftIsCorrect ? "left" : "right"))
          ? (q.msgCorrect || "Correct.")
          : (q.msgIncorrect || "Not quite.");
      }
      btnNext.style.display = "";
    } else {
      btnNext.style.display = "none";
    }

    // Back button is always available; on first question it still moves back a page in history
  }

  function handlePick(which) {
    const target = (which === "left") ? imgLeft : imgRight;
    const q = QUIZ.questions[idx];
    const bothOk = currentIsBothCorrect();

    if (answeredCorrect[idx]) return; // already graded

    const isCorrect = (target.dataset.correct === "true");
    chosenSide[idx] = which;

    clearBorders();

    if (bothOk) {
      // Both correct: show both green, show both-correct message
      setBorder(imgLeft,  "#10b981");
      setBorder(imgRight, "#10b981");
      msgBox.textContent = q.msgBothCorrect || "Either choice is acceptable.";
      answeredCorrect[idx] = true;
      btnNext.style.display = "";
      return;
    }

    if (isCorrect) {
      const other = (which === "left") ? imgRight : imgLeft;
      setBorder(target, "#10b981");
      setBorder(other,  "#ef4444");
      msgBox.textContent = q.msgCorrect || "Correct.";
      answeredCorrect[idx] = true;
      btnNext.style.display = "";
    } else {
      setBorder(target, "#ef4444");
      msgBox.textContent = q.msgIncorrect || "Not quite.";
      // Next remains hidden until correct
    }
  }

  function goNext() {
    // If last question and answered, leave the quiz
    if (idx === N - 1 && answeredCorrect[idx]) {
      location.href = NEXT_PAGE + baseQueryString();
      return;
    }
    // Otherwise, move forward within quiz if possible
    if (idx < N - 1) {
      idx += 1;
      paintQuestion();
    }
  }

  function goBack() {
    if (idx > 0) {
      idx -= 1;
      paintQuestion();
    } else {
      // If at first question, attempt browser back (or do nothing)
      history.length > 1 ? history.back() : void 0;
    }
  }

  // Events
  document.getElementById("xImgLeft").addEventListener("click",  () => handlePick("left"));
  document.getElementById("xImgRight").addEventListener("click", () => handlePick("right"));
  document.getElementById("xBackButton").addEventListener("click", goBack);
  document.getElementById("xNextButton").addEventListener("click", goNext);

  [imgLeft, imgRight].forEach(el => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handlePick(el === imgLeft ? "left" : "right");
      }
    });
  });

  // Initial paint
  paintQuestion();
})();
