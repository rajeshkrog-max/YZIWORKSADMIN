import { useRef, useState } from 'react'
import seraVideo from '../assets/sera.mp4'

function VideoModal({ isOpen, onClose }) {
  const videoRef = useRef(null)
  const [isMuted, setIsMuted] = useState(true)

  if (!isOpen) return null

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      
      {/* Glowing border container */}
      <div className="relative w-full max-w-4xl mx-4">
        
        {/* Glow effect */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-yzi-orange via-yzi-pink to-yzi-purple opacity-70 blur-sm"></div>
        
        {/* Video box */}
        <div className="relative bg-yzi-black rounded-2xl overflow-hidden border border-white/10">
          
          <video
            ref={videoRef}
            src={seraVideo}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video object-cover"
          />

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent">
            
            <button
              onClick={toggleMute}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium backdrop-blur-md transition"
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-yzi-orange to-yzi-pink text-sm font-semibold hover:scale-105 transition-transform"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoModal