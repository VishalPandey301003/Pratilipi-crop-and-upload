// ==UserScript==
// @name         Pratilipi Crop & Upload Tool (Max 1.5MB slices)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Crop tall images by scaling to 800px width, slice into 800x1000 chunks and only upload slices ≤ 1.5 MB
// @match        https://pratilipicomics.com/me/comics/*/episodes/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const targetWidth = 800;
  const cropHeight = 1000;
  const maxSliceSize = 1.4 * 1024 * 1024; // 1.5 MB in bytes

  function addButton() {
    const label = document.querySelector("label.custom-file-label");
    const uploadInput = document.querySelector("#bulk-add-images");

    if (label && uploadInput && !document.querySelector("#crop-upload-btn")) {
      const cropButton = document.createElement("button");
      cropButton.textContent = "Crop & Upload Tall Images";
      cropButton.id = "crop-upload-btn";
      Object.assign(cropButton.style, {
        marginLeft: "10px",
        backgroundColor: "#28a745",
        color: "white",
        border: "none",
        padding: "6px 12px",
        borderRadius: "4px",
        cursor: "pointer"
      });

      label.parentElement.appendChild(cropButton);

      const hiddenInput = document.createElement("input");
      hiddenInput.type = "file";
      hiddenInput.accept = "image/*";
      hiddenInput.multiple = true;
      hiddenInput.style.display = "none";
      document.body.appendChild(hiddenInput);

      cropButton.addEventListener("click", () => hiddenInput.click());

      hiddenInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const dt = new DataTransfer();

        for (let file of files) {
          const img = new Image();
          img.src = URL.createObjectURL(file);
          await img.decode();

          const scale = targetWidth / img.width;
          const newHeight = Math.floor(img.height * scale);

          // Resize original image to 800px width
          const resizedCanvas = document.createElement("canvas");
          const resizedCtx = resizedCanvas.getContext("2d");
          resizedCanvas.width = targetWidth;
          resizedCanvas.height = newHeight;
          resizedCtx.drawImage(img, 0, 0, targetWidth, newHeight);

          const totalSlices = Math.ceil(newHeight / cropHeight);

          for (let i = 0; i < totalSlices; i++) {
            const sliceHeight = Math.min(cropHeight, newHeight - i * cropHeight);
            canvas.width = targetWidth;
            canvas.height = sliceHeight;

            ctx.clearRect(0, 0, targetWidth, sliceHeight);
            ctx.drawImage(resizedCanvas, 0, -i * cropHeight);

            const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

            if (blob.size <= maxSliceSize) {
              const newFile = new File(
                [blob],
                `${file.name.replace(/\.[^/.]+$/, "")}_slice_${i + 1}.png`,
                { type: "image/png" }
              );
              dt.items.add(newFile);
            } else {
              console.log(`Skipped slice ${i + 1} of ${file.name} — size ${ (blob.size/1024/1024).toFixed(2)} MB exceeds 1.5 MB limit`);
            }
          }
        }

        if (dt.items.length === 0) {
          console.log("No slices under 1.5 MB found; upload canceled.");
        } else {
          uploadInput.files = dt.files;
          uploadInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }
  }

  // Keep trying until label & upload input exist
  const tryAddButton = setInterval(() => {
    addButton();
    if (document.querySelector("#crop-upload-btn")) {
      clearInterval(tryAddButton);
    }
  }, 500);

  // Watch for dynamic changes on page
  const observer = new MutationObserver(() => {
    addButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
