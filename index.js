// make the checkbox div focusable
const captchaCheckbox = document.getElementById("captcha-checkbox")
const checkboxSpinner = document.getElementById("captcha-checkbox-spinner")

captchaCheckbox.addEventListener("mousedown", () => {
  captchaCheckbox.classList.add("focused")
  captchaCheckbox.classList.remove("blurred")
})

captchaCheckbox.addEventListener("mouseup", () => {
  captchaCheckbox.classList.add("blurred")
  captchaCheckbox.classList.remove("focused")
})

captchaCheckbox.addEventListener("click", () => {
  checkboxSpinner.style.display = "block"
  captchaCheckbox.style.display = "none"
  captchaCheckbox.style.visibility = "false"

  setTimeout(() => {
    captchaCheckbox.style.display = "block"
    checkboxSpinner.style.display = "none"

    // show the solve box
    const solveBox = document.getElementById("solve-box")
    if (solveBox.style.display == "block") {
      solveBox.style.display = "none"
    } else {
      solveBox.style.display = "block"
    }
  }, Math.floor(Math.random() * 1000) + 200)
})

// show error if submit button is click without checking the checkbox
document.getElementById("submit").addEventListener("click", () => {
  document.getElementById("captcha-main-div").classList.add("error")
  document.getElementById("captcha-error-msg").style.display = "block"
})

// -------------------- SUCCESS (CONGRATS + YOUTUBE) --------------------
const captchaMain = document.getElementById("captcha-main-div")
const success = document.getElementById("success")
const ytFrame = document.getElementById("yt")

// Correct embed URL (not youtu.be, not watch?v=). Unmuted.
const YT_EMBED_URL = "https://www.youtube.com/embed/KfDargQ3jis?start=1&autoplay=1"

function showSuccess() {
  if (captchaMain) captchaMain.style.display = "none"
  if (success) success.style.display = "block"
  if (ytFrame) ytFrame.src = YT_EMBED_URL
}

// -------------------- CAPTCHA LOGIC --------------------
const imageCount = 24

// Targets split into 2 stages: 3 targets first, then the other 3
const stage1Targets = [4, 5, 6]
const stage2Targets = [7, 8, 9]
const requiredTargets = new Set([...stage1Targets, ...stage2Targets])

let stage = 1 // 1 or 2
const selectedTargets = new Set()
let hasInvalidSelection = false

// Never show any image more than once overall
const usedNumbers = new Set()
// Never show any image more than once at the same time
const currentOnScreen = new Set()

// IMPORTANT FIX: track pending refresh timeouts per tile, so they cannot overwrite stage 2 targets
const pendingRefreshTimeoutByImg = new Map()

const getImgNumber = (imgEl) => {
  const src = imgEl.getAttribute("src") || ""
  const m = src.match(/img(\d+)\.(?:jpg|png)$/)
  return m ? Number(m[1]) : null
}

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const currentStageTargetSet = () => {
  return stage === 1 ? new Set(stage1Targets) : new Set(stage2Targets)
}

const isValidNow = (n) => n !== null && currentStageTargetSet().has(n)

const isAnyValidVisibleNow = () => {
  const imgs = Array.from(document.querySelectorAll(".solve-image"))
  return imgs.some((img) => isValidNow(getImgNumber(img)))
}

// Filler deck: only non-target images 1..imageCount excluding 4..9.
const fillerNumbers = []
for (let n = 1; n <= imageCount; n++) {
  if (!requiredTargets.has(n)) fillerNumbers.push(n)
}
const fillerDeck = shuffle(fillerNumbers)

const drawFiller = () => {
  while (fillerDeck.length > 0) {
    const n = fillerDeck.shift()
    if (usedNumbers.has(n)) continue
    if (currentOnScreen.has(n)) continue
    return n
  }
  return null
}

// If n is null (deck exhausted), hide the tile instead of showing a broken image icon.
const setImageNumber = (imgEl, n) => {
  const prev = getImgNumber(imgEl)
  if (prev !== null) currentOnScreen.delete(prev)

  if (n === null) {
    imgEl.setAttribute("src", "")
    imgEl.style.visibility = "hidden"
    imgEl.style.pointerEvents = "none"
    return
  }

  imgEl.style.visibility = "visible"
  imgEl.setAttribute("src", `./images/img${n}.jpg`)
  imgEl.style.pointerEvents = "auto"

  usedNumbers.add(n)
  currentOnScreen.add(n)
}

// brief fade if there are no valid images on screen but there are still valid images to find in the current stage
const fadeAllIfNoValidVisible = () => {
  const stageTargets = stage === 1 ? stage1Targets : stage2Targets
  const remaining = stageTargets.filter((n) => !selectedTargets.has(n))
  if (remaining.length === 0) return
  if (isAnyValidVisibleNow()) return

  const imgs = Array.from(document.querySelectorAll(".solve-image"))
  imgs.forEach((img) => img.classList.add("fade-out"))
  setTimeout(() => {
    imgs.forEach((img) => img.classList.remove("fade-out"))
  }, 300)
}

// build 3×3 grid and keep references to all tiles
const solveImageContainer = document.getElementById("solve-image-main-container")
const gridImages = []

for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    const imageContainer = document.createElement("div")
    imageContainer.classList.add("solve-image-container")

    const image = document.createElement("img")
    image.classList.add("solve-image")

    image.addEventListener("click", () => {
      const num = getImgNumber(image)

      // Valid click (for current stage)
      if (isValidNow(num) && !selectedTargets.has(num)) {
        selectedTargets.add(num)

        // Replace the selected valid image with a filler so it cannot reappear
        refreshToFiller(image)

        // If stage 1 complete, transition to stage 2
        if (stage === 1 && stage1Targets.every((n) => selectedTargets.has(n))) {
          advanceToStage2()
        }
        return
      }

      // Invalid click: mark failure and refresh that tile to a filler
      hasInvalidSelection = true
      refreshToFiller(image)
    })

    gridImages.push(image)
    imageContainer.appendChild(image)
    solveImageContainer.appendChild(imageContainer)
  }
}

// Refresh a tile to the next filler image (no targets here).
// Do not let an unselected valid image disappear (avoids impossible stage).
const refreshToFiller = (image) => {
  const current = getImgNumber(image)
  if (isValidNow(current) && !selectedTargets.has(current)) return

  // FIX: cancel any previous pending timeout for this image
  const prior = pendingRefreshTimeoutByImg.get(image)
  if (prior) {
    clearTimeout(prior)
    pendingRefreshTimeoutByImg.delete(image)
  }

  image.classList.add("fade-out")
  image.style.pointerEvents = "none"

  const timeoutId = setTimeout(() => {
    pendingRefreshTimeoutByImg.delete(image)
    setImageNumber(image, drawFiller())
    fadeAllIfNoValidVisible()
    image.classList.remove("fade-out")
    image.style.pointerEvents = "auto"
  }, 1000)

  pendingRefreshTimeoutByImg.set(image, timeoutId)
}

// Place the three stage-1 valid images into RANDOM positions, not “top row”.
const initialFillStage1 = () => {
  const positions = shuffle([...Array(9).keys()]) // 0..8 shuffled
  const targets = shuffle([...stage1Targets])

  // Place 3 valid targets
  for (let k = 0; k < 3; k++) {
    setImageNumber(gridImages[positions[k]], targets[k])
  }

  // Fill remaining 6 with fillers
  for (let k = 3; k < 9; k++) {
    setImageNumber(gridImages[positions[k]], drawFiller())
  }

  fadeAllIfNoValidVisible()
}

// FIX: ensure no pending refresh can overwrite stage-2 targets
const cancelAllPendingTileRefreshes = () => {
  for (const [imgEl, timeoutId] of pendingRefreshTimeoutByImg.entries()) {
    clearTimeout(timeoutId)
    imgEl.classList.remove("fade-out")
    imgEl.style.pointerEvents = "auto"
  }
  pendingRefreshTimeoutByImg.clear()
}

// Stage transition: fade, then place stage-2 valid images in RANDOM positions.
const advanceToStage2 = () => {
  stage = 2

  // FIX: cancel any in-flight tile refresh that might overwrite the new targets
  cancelAllPendingTileRefreshes()

  solveImageContainer.classList.add("fade-out")
  setTimeout(() => {
    solveImageContainer.classList.remove("fade-out")

    const positions = shuffle([...Array(9).keys()])
    const targets = shuffle([...stage2Targets])

    // Place 3 stage-2 targets into random positions (overwrite whatever was there)
    for (let k = 0; k < 3; k++) {
      const imgEl = gridImages[positions[k]]
      imgEl.classList.remove("fade-out")
      imgEl.style.pointerEvents = "auto"
      setImageNumber(imgEl, targets[k])
    }

    fadeAllIfNoValidVisible()
  }, 500)
}

initialFillStage1()

// Verify succeeds only if:
// - all 6 targets selected
// - no invalid image ever selected
document.getElementById("verify").addEventListener("click", () => {
  const allTargetsSelected = Array.from(requiredTargets).every((n) =>
    selectedTargets.has(n)
  )

  if (allTargetsSelected && !hasInvalidSelection) {
    document.getElementById("solve-image-error-msg").style.display = "none"
    document.getElementById("solve-box").style.display = "none"
    showSuccess()
  } else {
    document.getElementById("solve-image-error-msg").style.display = "block"
  }
})

// Refresh button: refresh all non-valid tiles; keep any unselected valid image visible.
// Clears invalid flag to allow retry (your earlier behaviour).
const refreshButton = document.getElementById("refresh")
refreshButton.addEventListener("click", () => {
  refreshButton.style.pointerEvents = "none"
  solveImageContainer.classList.add("fade-out")
  document.getElementById("solve-image-error-msg").style.display = "none"

  setTimeout(() => {
    solveImageContainer.classList.remove("fade-out")

    // Also cancel in-flight refreshes when user hits refresh
    cancelAllPendingTileRefreshes()

    hasInvalidSelection = false

    gridImages.forEach((imgEl) => {
      const num = getImgNumber(imgEl)
      if (isValidNow(num) && !selectedTargets.has(num)) return
      setImageNumber(imgEl, drawFiller())
    })

    fadeAllIfNoValidVisible()
    refreshButton.style.pointerEvents = "auto"
  }, 1000)
})

// toggle information
document.getElementById("information").addEventListener("click", () => {
  const information = document.getElementById("information-text")
  if (information.style.display == "block") {
    information.style.display = "none"
  } else {
    information.style.display = "block"
  }
})

// show audio div
document.getElementById("audio").addEventListener("click", () => {
  document.getElementById("solve-image-div").style.display = "none"
  document.getElementById("solve-audio-div").style.display = "block"
})


