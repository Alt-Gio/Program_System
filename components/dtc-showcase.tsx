'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

export default function DTCShowcase({ dark }: { dark: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeCard, setActiveCard] = useState(0)

  const cards = [
    {
      id: 1,
      title: 'Conference Room',
      subtitle: 'Meeting & Collaboration Space',
      image: '/interactive-banner.jpg',
      badge: 'DTC Main',
      capacity: '30+ Seats',
      features: ['HD Display', 'Audio System', 'AC']
    },
    {
      id: 2,
      title: 'Open Workspace',
      subtitle: 'Collaboration Floor',
      image: '/BG.png',
      badge: 'Active Zone',
      capacity: '12 Workstations',
      features: ['Free WiFi', 'Power Outlets', 'Printing']
    },
    {
      id: 3,
      title: 'Training Area',
      subtitle: 'Digital Literacy Hub',
      image: '/dict-building.jpg',
      badge: 'Learning Space',
      capacity: '25+ Seats',
      features: ['Projector', 'Whiteboard', 'Computers']
    },
    {
      id: 4,
      title: 'Innovation Lab',
      subtitle: 'Tech Development Zone',
      image: '/interactive-banner.jpg',
      badge: 'Dev Space',
      capacity: '15 Stations',
      features: ['High-Speed Net', 'Dev Tools', 'Testing']
    },
    {
      id: 5,
      title: 'Community Hub',
      subtitle: 'Public Service Area',
      image: '/BG.png',
      badge: 'Open Access',
      capacity: 'Walk-ins Welcome',
      features: ['Free Access', 'Assistance', 'E-Services']
    }
  ]

  // Auto-scroll effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const cardWidth = scrollRef.current.offsetWidth
        const nextCard = (activeCard + 1) % cards.length
        scrollRef.current.scrollTo({
          left: cardWidth * nextCard,
          behavior: 'smooth'
        })
        setActiveCard(nextCard)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [activeCard, cards.length])

  const scrollToCard = (index: number) => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.offsetWidth
      scrollRef.current.scrollTo({
        left: cardWidth * index,
        behavior: 'smooth'
      })
      setActiveCard(index)
    }
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Horizontal scroll container */}
      <div 
        ref={scrollRef}
        className="flex h-full overflow-x-scroll snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={(e) => {
          const scrollLeft = e.currentTarget.scrollLeft
          const cardWidth = e.currentTarget.offsetWidth
          const newActive = Math.round(scrollLeft / cardWidth)
          if (newActive !== activeCard) setActiveCard(newActive)
        }}
      >
        {cards.map((card, index) => (
          <div
            key={card.id}
            className="min-w-full h-full snap-center flex items-center justify-center px-8 md:px-16 lg:px-24"
          >
            {/* 3D Card */}
            <div 
              className="relative w-full max-w-5xl"
              style={{ perspective: '1500px' }}
            >
              {/* Card container with 3D transform */}
              <div
                className="relative transition-transform duration-300 ease-out"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: activeCard === index ? 'rotateY(0deg) scale(1)' : 'rotateY(-5deg) scale(0.95)'
                }}
                onMouseMove={(e) => {
                  if (activeCard !== index) return
                  const card = e.currentTarget
                  const rect = card.getBoundingClientRect()
                  const x = (e.clientX - rect.left) / rect.width - 0.5
                  const y = (e.clientY - rect.top) / rect.height - 0.5
                  card.style.transform = `rotateY(${x * 15}deg) rotateX(${-y * 15}deg) scale(1)`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'rotateY(0deg) rotateX(0deg) scale(1)'
                }}
              >
                {/* Image container */}
                <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={card.image}
                      alt={card.title}
                      fill
                      className="object-cover"
                      priority={index === 0}
                    />
                    
                    {/* Gradient overlay */}
                    <div 
                      className="absolute inset-0"
                      style={{
                        background: dark
                          ? 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)'
                          : 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 100%)'
                      }}
                    />

                    {/* Glare effect */}
                    <div 
                      className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{
                        background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)'
                      }}
                    />
                  </div>

                  {/* Content overlay */}
                  <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
                    {/* Badge */}
                    <div className="absolute top-6 left-6">
                      <span 
                        className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider"
                        style={{
                          background: dark ? 'rgba(0,212,255,0.2)' : 'rgba(37,99,235,0.2)',
                          backdropFilter: 'blur(12px)',
                          border: `1px solid ${dark ? 'rgba(0,212,255,0.3)' : 'rgba(37,99,235,0.3)'}`,
                          color: dark ? '#00d4ff' : '#2563eb'
                        }}
                      >
                        {card.badge}
                      </span>
                    </div>

                    {/* Capacity badge */}
                    <div className="absolute top-6 right-6">
                      <span 
                        className="px-4 py-2 rounded-xl text-sm font-black"
                        style={{
                          background: dark ? '#00d4ff' : '#2563eb',
                          color: dark ? '#0e0f0d' : '#ffffff',
                          boxShadow: dark ? '0 8px 24px rgba(0,212,255,0.3)' : '0 8px 24px rgba(37,99,235,0.3)'
                        }}
                      >
                        {card.capacity}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-2 leading-tight">
                      {card.title}
                    </h2>
                    <p className="text-lg md:text-xl text-white/70 mb-6">
                      {card.subtitle}
                    </p>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2">
                      {card.features.map((feature, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-white/80"
                          style={{
                            background: 'rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.2)'
                          }}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3D depth shadow */}
                <div 
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-4/5 h-16 rounded-full blur-3xl opacity-50"
                  style={{
                    background: dark 
                      ? 'radial-gradient(ellipse, rgba(0,212,255,0.3) 0%, transparent 70%)'
                      : 'radial-gradient(ellipse, rgba(37,99,235,0.3) 0%, transparent 70%)'
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {cards.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToCard(index)}
            className="transition-all duration-300"
            style={{
              width: activeCard === index ? '32px' : '12px',
              height: '12px',
              borderRadius: '6px',
              background: activeCard === index 
                ? (dark ? '#00d4ff' : '#2563eb')
                : (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'),
              border: 'none',
              cursor: 'pointer'
            }}
          />
        ))}
      </div>

      {/* Navigation arrows */}
      <button
        onClick={() => scrollToCard((activeCard - 1 + cards.length) % cards.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 z-10"
        style={{
          background: dark ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${dark ? 'rgba(0,212,255,0.3)' : 'rgba(0,0,0,0.1)'}`,
          color: dark ? '#00d4ff' : '#2563eb'
        }}
      >
        ←
      </button>
      <button
        onClick={() => scrollToCard((activeCard + 1) % cards.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 z-10"
        style={{
          background: dark ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${dark ? 'rgba(0,212,255,0.3)' : 'rgba(0,0,0,0.1)'}`,
          color: dark ? '#00d4ff' : '#2563eb'
        }}
      >
        →
      </button>

      {/* Card counter */}
      <div 
        className="absolute top-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-bold z-10"
        style={{
          background: dark ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${dark ? 'rgba(0,212,255,0.3)' : 'rgba(0,0,0,0.1)'}`,
          color: dark ? '#00d4ff' : '#2563eb'
        }}
      >
        {activeCard + 1} / {cards.length}
      </div>

      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
