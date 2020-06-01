(function () {
  "use strict";

  const MESSAGE_TYPE = {
    SDP: "SDP",
    CANDIDATE: "CANDIDATE",
  };

  const MAXIMUM_MESSAGE_SIZE = 65535;
  const END_OF_FILE_MESSAGE = "EOF";
  let code;
  let peerConnection;
  let signaling;
  const senders = [];
  let userMediaStream;
  let displayMediaStream;
  let file;

  const startChat = async () => {
    try {
      userMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      showChatRoom();

      signaling = new WebSocket("ws://web-cam-webtrtc.herokuapp.com");
      peerConnection = createPeerConnection();

      addMessageHandler();

      userMediaStream
        .getTracks()
        .forEach((track) =>
          senders.push(peerConnection.addTrack(track, userMediaStream))
        );
      document.getElementById("self-view").srcObject = userMediaStream;
    } catch (err) {
      console.error(err);
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{urls: "stun:stun.m.test.com:19000"}],
    });

    pc.onnegotiationneeded = async () => {
      await createAndSendOffer();
    };

    pc.onicecandidate = (iceEvent) => {
      if (iceEvent && iceEvent.candidate) {
        sendMessage({
          message_type: MESSAGE_TYPE.CANDIDATE,
          content: iceEvent.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const video = document.getElementById("remote-view");
      video.srcObject = userMediaStream;
      // video.srcObject = event.streams[0];
    };

    pc.ondatachannel = (event) => {
      const {channel} = event;
      channel.binaryType = "arraybuffer";

      const receivedBuffers = [];
      channel.onmessage = async (event) => {
        const {data} = event;
        try {
          if (data !== END_OF_FILE_MESSAGE) {
            receivedBuffers.push(data);
          } else {
            const arrayBuffer = receivedBuffers.reduce((acc, arrayBuffer) => {
              const tmp = new Uint8Array(
                acc.byteLength + arrayBuffer.byteLength
              );
              tmp.set(new Uint8Array(acc), 0);
              tmp.set(new Uint8Array(arrayBuffer), acc.byteLength);
              return tmp;
            }, new Uint8Array());
            const blob = new Blob([arrayBuffer]);
            downloadFile(blob, channel.label);
            channel.close();
          }
        } catch (err) {
          console.log("File transfer failed");
        }
      };
    };

    return pc;
  };

  const addMessageHandler = () => {
    signaling.onmessage = async (message) => {
      const data = JSON.parse(message.data);

      if (!data) {
        return;
      }

      const {message_type, content} = data;
      try {
        if (message_type === MESSAGE_TYPE.CANDIDATE && content) {
          await peerConnection.addIceCandidate(content);
        } else if (message_type === MESSAGE_TYPE.SDP) {
          if (content.type === "offer") {
            await peerConnection.setRemoteDescription(content);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            sendMessage({
              message_type: MESSAGE_TYPE.SDP,
              content: answer,
            });
          } else if (content.type === "answer") {
            await peerConnection.setRemoteDescription(content);
          } else {
            console.log("Unsupported SDP type.");
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
  };

  const sendMessage = (message) => {
    if (code) {
      signaling.send(
        JSON.stringify({
          ...message,
          code,
        })
      );
    }
  };

  const createAndSendOffer = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    sendMessage({
      message_type: MESSAGE_TYPE.SDP,
      content: offer,
    });
  };

  const showChatRoom = () => {
    document.getElementById("start").style.display = "none";
    document.getElementById("chat-room").style.display = "grid";
  };

  document
    .getElementById("code-input")
    .addEventListener("input", async (event) => {
      const {value} = event.target;
      if (value.length > 8) {
        document.getElementById("start-button").disabled = false;
        code = value;
      } else {
        document.getElementById("start-button").disabled = true;
        code = null;
      }
    });

  document
    .getElementById("start-button")
    .addEventListener("click", async () => {
      if (code) {
        startChat();
      }
    });
})();
