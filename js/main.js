(function () {
  "use strict";

  const MESSAGE_TYPE = {
    SDP: "SDP",
    CANDIDATE: "CANDIDATE",
  };

  let peerConnection;
  let signaling;
  const senders = [];
  let code = 12345678999;
  let stream;

  document.getElementById("start").addEventListener("click", async () => {
    startChat();
  });

  const startChat = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
      showChatRoom();
      signaling = new WebSocket("ws://127.0.0.1:1337");
      const peerConnection = createPeerConnection();
      addMessageHandler();
      stream
        .getTracks()
        .forEach((track) =>
          senders.push(peerConnection.addTrack(track, stream))
        );
      document.getElementById("self-view").srcObject = stream;
    } catch (err) {
      console.error(err);
    }
  };

  const createPeerConnection = (signaling) => {
    peerConnection = new RTCPeerConnection({
      iceServers: [{urls: "stun:stun.l.test.com:19000"}],
    });
    peerConnection.onnegotiationneeded = async () => {
      await createAndSendOffer();
    };
    peerConnection.onicecandidate = (iceEvent) => {
      if (iceEvent && iceEvent.candidate) {
        sendMessage({
          message_type: MESSAGE_TYPE.CANDIDATE,
          content: iceEvent.candidate,
        });
      }
    };
    peerConnection.ontrack = (event) => {
      const video = document.getElementById("remote-view");
      video.srcObject = stream;
    };

    peerConnection.ondatachannel = (event) => {
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

    return peerConnection;
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
  const createAndSendOffer = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendMessage({
      message_type: MESSAGE_TYPE.SDP,
      content: offer,
    });
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
  const showChatRoom = () => {
    document.getElementById("self-view").style.display = "none";
    document.getElementById("start").style.display = "none";
    document.getElementById("chat-room").style.display = "block";
  };
})();
