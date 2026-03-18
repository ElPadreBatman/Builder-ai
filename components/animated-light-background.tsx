"use client"

import { useEffect, useRef } from "react"
import { motion, useScroll, useTransform, useSpring } from "framer-motion"

// Animated vertical light beams - more visible
const lightBeams = [
  { x: "5%", delay: 0, duration: 6, opacity: 0.4 },
  { x: "15%", delay: 1.5, duration: 8, opacity: 0.35 },
  { x: "25%", delay: 0.5, duration: 5, opacity: 0.45 },
  { x: "35%", delay: 2, duration: 7, opacity: 0.3 },
  { x: "45%", delay: 1, duration: 9, opacity: 0.4 },
  { x: "55%", delay: 2.5, duration: 6, opacity: 0.35 },
  { x: "65%", delay: 0.8, duration: 8, opacity: 0.3 },
  { x: "75%", delay: 1.8, duration: 5, opacity: 0.45 },
  { x: "85%", delay: 0.3, duration: 7, opacity: 0.35 },
  { x: "95%", delay: 2.2, duration: 6, opacity: 0.4 },
]

// Floating particles
const particles = [
  { x: "10%", y: "20%", size: 4, delay: 0, duration: 6 },
  { x: "30%", y: "40%", size: 3, delay: 1, duration: 8 },
  { x: "50%", y: "15%", size: 5, delay: 0.5, duration: 7 },
  { x: "70%", y: "60%", size: 3, delay: 2, duration: 9 },
  { x: "90%", y: "30%", size: 4, delay: 1.5, duration: 6 },
  { x: "20%", y: "70%", size: 3, delay: 0.8, duration: 8 },
  { x: "60%", y: "80%", size: 4, delay: 2.5, duration: 7 },
  { x: "80%", y: "45%", size: 3, delay: 1.2, duration: 9 },
]

export function AnimatedLightBackground() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll()

  return (
    <div ref={ref} className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-white to-white" />

      {/* Animated vertical light beams */}
      {lightBeams.map((beam, i) => (
        <motion.div
          key={`beam-${i}`}
          className="absolute top-0 w-1 h-full"
          style={{ left: beam.x }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{
            opacity: [0, beam.opacity, beam.opacity, 0],
            scaleY: [0, 1, 1, 0],
          }}
          transition={{
            duration: beam.duration,
            delay: beam.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="w-full h-full bg-gradient-to-b from-transparent via-orange-500/60 to-transparent blur-sm" />
        </motion.div>
      ))}

      {/* Wider accent beams */}
      {[
        { x: "20%", delay: 0, duration: 8 },
        { x: "50%", delay: 2, duration: 7 },
        { x: "80%", delay: 1, duration: 9 },
      ].map((beam, i) => (
        <motion.div
          key={`wide-beam-${i}`}
          className="absolute top-0 w-16 h-full"
          style={{ left: beam.x }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.15, 0.15, 0],
          }}
          transition={{
            duration: beam.duration,
            delay: beam.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="w-full h-full bg-gradient-to-b from-transparent via-orange-400 to-transparent blur-2xl" />
        </motion.div>
      ))}

      {/* Floating particles */}
      {particles.map((particle, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute rounded-full bg-orange-400/30"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [-20, 20, -20],
            opacity: [0.2, 0.5, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Ambient glow orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-orange-300/40 blur-[150px]"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-orange-400/30 blur-[120px]"
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.25, 0.45, 0.25],
        }}
        transition={{
          duration: 8,
          delay: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-1/2 right-1/3 w-[300px] h-[300px] rounded-full bg-orange-500/20 blur-[100px]"
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{
          duration: 7,
          delay: 1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Top gradient fade */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-orange-50 to-transparent" />
    </div>
  )
}

export default AnimatedLightBackground
