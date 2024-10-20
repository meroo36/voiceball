"use client";
// pages/index.tsx
import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

const socket: Socket = io();

export default function Home() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const localStreamRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null); // Changed to video
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function getUserMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;

        if (localStreamRef.current) {
          localStreamRef.current.srcObject = stream;
        }

        const peerConnection = new RTCPeerConnection();
        peerConnectionRef.current = peerConnection;

        stream
          .getTracks()
          .forEach((track) => peerConnection.addTrack(track, stream));

        peerConnection.ontrack = (event) => {
          const [remoteStream] = event.streams;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream; // Display the remote stream
          }
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", event.candidate);
          }
        };

        socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
          try {
            if (peerConnectionRef.current) {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
              );
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              socket.emit("answer", answer);
            }
          } catch (error) {
            console.error("Error handling offer:", error);
          }
        });

        socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
          try {
            if (peerConnectionRef.current) {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(answer)
              );
            }
          } catch (error) {
            console.error("Error handling answer:", error);
          }
        });

        socket.on("ice-candidate", async (candidate: RTCIceCandidateInit) => {
          try {
            if (candidate && peerConnectionRef.current) {
              await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
            }
          } catch (error) {
            console.error("Error adding ICE candidate:", error);
          }
        });

        setIsConnected(true);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }

    getUserMedia();
  }, []);

  const createOffer = async () => {
    if (peerConnectionRef.current) {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      socket.emit("offer", offer);
    }
  };

  const toggleMute = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const hangUp = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsConnected(false);
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          height: 1080, // Request high resolution
          width: 1920, // Request high resolution
          frameRate: { ideal: 30, max: 60 }, // Set frame rate (30-60 fps)
        },
        audio: true, // Include audio from the screen
      });

      screenStream.getTracks().forEach((track) => {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.addTrack(track, screenStream);
        }
      });

      // Show the shared screen on the remote side
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = screenStream;
      }
      setIsScreenSharing(true);
    } catch (error) {
      console.error("Error sharing screen:", error);
    }
  };

  const stopScreenShare = () => {
    if (peerConnectionRef.current) {
      const tracks = peerConnectionRef.current
        .getSenders()
        .filter((sender) => sender.track?.kind === "video");
      tracks.forEach((sender) => {
        sender.track?.stop(); // Stop the video track
        peerConnectionRef.current!.removeTrack(sender); // Remove it from the connection
      });
    }
    setIsScreenSharing(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold mb-4">Voice Chat</h1>
      <audio ref={localStreamRef} autoPlay muted />
      <video
        ref={remoteVideoRef}
        autoPlay
        className="border border-gray-500 rounded"
        style={{
          width: "100%",
          height: "auto",
          maxWidth: "1920px",
          maxHeight: "1080px",
        }}
      />
      <div className="flex space-x-4 mt-4">
        <button
          onClick={createOffer}
          disabled={!isConnected}
          className="bg-blue-500 text-white p-2 rounded"
        >
          Start Call
        </button>
        <button
          onClick={toggleMute}
          className={`bg-${
            isMuted ? "gray-500" : "green-500"
          } text-white p-2 rounded`}
        >
          {isMuted ? "Unmute" : "Mute"}
        </button>
        <button
          onClick={hangUp}
          disabled={!isConnected}
          className="bg-red-500 text-white p-2 rounded"
        >
          Hang Up
        </button>
        <button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          className="bg-yellow-500 text-white p-2 rounded"
        >
          {isScreenSharing ? "Stop Sharing" : "Share Screen"}
        </button>
      </div>
      <p className="mt-4">{isConnected ? "Connected" : "Not Connected"}</p>
    </div>
  );
}
