// make the checkbox div focusable
const captchaCheckbox = document.getElementById("captcha-checkbox")
const checkboxSpinner = document.getElementById("captcha-checkbox-spinner")
captchaCheckbox.addEventListener("mousedown",()=> {
    captchaCheckbox.classList.add("focused")
    captchaCheckbox.classList.remove("blurred")
})

captchaCheckbox.addEventListener("mouseup",()=> {
    captchaCheckbox.classList.add("blurred")
    captchaCheckbox.classList.remove("focused")
})

captchaCheckbox.addEventListener("click",()=> {
    checkboxSpinner.style.display = "block"
    captchaCheckbox.style.display = "none"
    captchaCheckbox.style.visibility = "false"
    setTimeout(()=>{
        captchaCheckbox.style.display = "block"
        checkboxSpinner.style.display = "none"

        // show the solve box
        const solveBox = document.getElementById("solve-box")
        if (solveBox.style.display == "block") {
            solveBox.style.display = "none"
        }
        else {
            solveBox.style.display = "block"
        }
    },Math.floor(Math.random()*1000)+200)
})

// show error if submit button is click without checking the checkbox
document.getElementById("submit").addEventListener("click",()=>{
    document.getElementById("captcha-main-div").classList.add("error")
    document.getElementById("captcha-error-msg").style.display = "block"
})


// -------------------- CAPTCHA LOGIC --------------------
const imageCount = 20

// Targets split into 2 stages: 3 targets first, then the other 3
const stage1Targets = [4,5,6]
const stage2Targets = [7,8,9]
const requiredTargets = new Set([...stage1Targets, ...stage2Targets])

let stage = 1 // 1 or 2
const selectedTargets = new Set()
let hasInvalidSelection = false

// Global constraints
const usedNumbers = new Set()       // never appear again once used anywhere
const currentOnScreen = new Set()   // never appear twice at same time

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

// Priority queue guarantees which valid images appear next.
// Stage 1 starts with only three valid images.
let priorityQueue = shuffle([...stage1Targets])

// Deck is for non-target filler images; built once and consumed sequentially.
const nonTargetNumbers = []
for (let n = 1; n <= imageCount; n++) {
  if (!requiredTargets.has(n)) nonTargetNumbers.push(n)
}
let deck = shuffle(nonTargetNumbers)

const currentStageTargetSet = () => {
  return stage === 1 ? new Set(stage1Targets) : new Set(stage2Targets)
}

const isValidNow = (n) => {
  if (n === null) return false
  return currentStageTargetSet().has(n)
}

const isAnyValidVisibleNow = () => {
  const imgs = Array.from(document.querySelectorAll(".solve-image"))
  return imgs.some(img => isValidNow(getImgNumber(img)))
}

// brief fade if there are no valid images on screen but there are still valid images to find in the current stage
const fadeAllIfNoValidVisible = () => {
  const stageTargets = stage === 1 ? stage1Targets : stage2Targets
  const remaining = stageTargets.filter(n => !selectedTargets.has(n))
  if (remaining.length === 0) return
  if (isAnyValidVisibleNow()) return

  const imgs = Array.from(document.querySelectorAll(".solve-image"))
  imgs.forEach(img => img.classList.add("fade-out"))
  setTimeout(() => {
    imgs.forEach(img => img.classList.remove("fade-out"))
  }, 300)
}

const setImageNumber = (imgEl, n) => {
  const prev = getImgNumber(imgEl)
  if (prev !== null) currentOnScreen.delete(prev)

  if (n === null) {
    imgEl.setAttribute("src", "")
    imgEl.style.pointerEvents = "none"
    return
  }

  // Uses .jpg by default
  imgEl.setAttribute("src", `./images/img${n}.jpg`)
  imgEl.style.pointerEvents = "auto"

  usedNumbers.add(n)
  currentOnScreen.add(n)
}

const drawFromPriority = () => {
  // Take the next available priority number that is not used and not on-screen.
  while (priorityQueue.length > 0) {
    const n = priorityQueue.shift()
    if (selectedTargets.has(n)) continue
    if (usedNumbers.has(n)) continue
    if (currentOnScreen.has(n)) continue
    return n
  }
  return null
}

const drawFromDeck = () => {
  while (deck.length > 0) {
    const n = deck.shift()
    if (usedNumbers.has(n)) continue
    if (currentOnScreen.has(n)) continue
    return n
  }
  return null
}

const drawNextNumber = () => {
  // Prefer remaining current-stage targets (sequentially via priorityQueue)
  const p = drawFromPriority()
  if (p !== null) return p
  return drawFromDeck()
}

// Prevent unselected valid images from disappearing (otherwise stage may become impossible)
const refreshImage = (image) => {
  const current = getImgNumber(image)
  if (isValidNow(current) && !selectedTargets.has(current)) {
    return
  }

  image.classList.add("fade-out")
  image.style.pointerEvents = "none"

  setTimeout(() => {
    const n = drawNextNumber()
    setImageNumber(image, n)
    fadeAllIfNoValidVisible()
    image.classList.remove("fade-out")
    image.style.pointerEvents = "auto"
  }, 1000)
}

// Stage transition: fade entire puzzle, then make next 3 valid images available and refresh non-valid tiles
const advanceToStage2 = () => {
  stage = 2
  priorityQueue = shuffle([...stage2Targets])

  // fade the whole grid
  solveImageContainer.classList.add("fade-out")
  setTimeout(() => {
    solveImageContainer.classList.remove("fade-out")

    // refresh every tile that is NOT an unselected valid (in stage 2, that means keep 7/8/9 if already visible, otherwise draw them)
    const imgs = Array.from(document.querySelectorAll(".solve-image"))
    imgs.forEach(img => {
      const num = getImgNumber(img)
      if (isValidNow(num) && !selectedTargets.has(num)) return
      const n = drawNextNumber()
      setImageNumber(img, n)
    })

    fadeAllIfNoValidVisible()
  }, 500)
}


// build 3×3 grid
const solveImageContainer = document.getElementById("solve-image-main-container")
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    const imageContainer = document.createElement("div")
    imageContainer.classList.add("solve-image-container")

    const image = document.createElement("img")
    image.classList.add("solve-image")

    // Initial fill: first three tiles drawn from priorityQueue will be the 3 stage-1 valid images.
    setImageNumber(image, drawNextNumber())

    image.addEventListener("click", () => {
      const num = getImgNumber(image)

      // If user clicks a valid image (for the current stage), mark it selected, then replace it
      if (isValidNow(num) && !selectedTargets.has(num)) {
        selectedTargets.add(num)
        refreshImage(image)

        // If stage 1 is complete, fade and reveal the other three valid images
        if (stage === 1 && stage1Targets.every(n => selectedTargets.has(n))) {
          advanceToStage2()
        }

        return
      }

      // If user clicks an invalid image, mark invalid selection and refresh that tile
      hasInvalidSelection = true
      refreshImage(image)
    })

    imageContainer.appendChild(image)
    solveImageContainer.appendChild(imageContainer)
  }
}

fadeAllIfNoValidVisible()

// Verify succeeds only if:
// - all required targets were selected
// - no invalid image was ever selected
document.getElementById("verify").addEventListener("click", () => {
  const allTargetsSelected = Array.from(requiredTargets).every(n => selectedTargets.has(n))
  if (allTargetsSelected && !hasInvalidSelection) {
    document.getElementById("solve-image-error-msg").style.display = "none"
    document.getElementById("solve-box").style.display = "none"
  } else {
    document.getElementById("solve-image-error-msg").style.display = "block"
  }
})

// Refresh button: refresh all non-valid tiles; keep any unselected valid image visible.
// This also clears the "invalid selected" flag to allow retry.
const refreshButton = document.getElementById("refresh")
refreshButton.addEventListener("click", () => {
  refreshButton.style.pointerEvents = "none"
  solveImageContainer.classList.add("fade-out")
  document.getElementById("solve-image-error-msg").style.display = "none"

  setTimeout(() => {
    solveImageContainer.classList.remove("fade-out")

    hasInvalidSelection = false

    const imgs = Array.from(document.querySelectorAll(".solve-image"))
    imgs.forEach(img => {
      const num = getImgNumber(img)
      if (isValidNow(num) && !selectedTargets.has(num)) return
      setImageNumber(img, drawNextNumber())
    })

    fadeAllIfNoValidVisible()
    refreshButton.style.pointerEvents = "auto"
  }, 1000)
})


// toggle information
document.getElementById("information").addEventListener("click",() =>{
    const information = document.getElementById("information-text")
    if (information.style.display == "block") {
        information.style.display = "none"
    }
    else {
        information.style.display = "block"
    }
})

// show audio div
document.getElementById("audio").addEventListener("click",()=> {
    document.getElementById("solve-image-div").style.display = "none"
    document.getElementById("solve-audio-div").style.display = "block"
})


