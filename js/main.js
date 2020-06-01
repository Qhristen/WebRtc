(function () {
  "use strict";

  document.addEventListener("click", async (event) => {
    if (event.target.id === "start") {
      const stream = await window.navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      const video = document.getElementById("remote-view");
      const viewVideo = document.getElementById("chat-room");
      const sefView = document.getElementById("self-view");
      sefView.style.display = "none";
      viewVideo.style.display = "block";
      video.style.width = "100vh";
      video.srcObject = stream;
      video.play();
    }
  });
})();
