'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Map as MapIcon, Users, Activity, ExternalLink, Filter, ChevronLeft } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import Link from 'next/link'

export default function ProfileHandlePage() {
  const params = useParams()
  const handle = params.handle as string
  const { userHandle, isAuthenticated } = useAuth()
  
  const [activeTab, setActiveTab] = useState<'publications' | 'saved'>('publications')
  
  const isOwnProfile = isAuthenticated && userHandle === handle

  // Placeholder mock data - this would be fetched from your /api/v1/users/{handle} 
  // and /api/v1/publications streams in production.
  const profileData = {
    handle: handle,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    role: 'Enterprise Analyst',
    followers: 124,
    following: 89,
    publications: 12,
    location: 'Boulder, CO'
  }

  const mockPublications = [
    {
      id: '1',
      title: 'GeoSphere: Boulder Valley Spatial Plan',
      categories: ['Vector', 'Urban Planning'],
      likes: 34,
      comments: 8,
      date: '2026-06-15'
    },
    {
      id: '2',
      title: 'Rocky Mountain Elevation Model - Dynamic Labels',
      categories: ['DEM', '3D', 'LiDAR'],
      likes: 112,
      comments: 24,
      date: '2026-05-22'
    }
  ]

  return (
    <div className="py-6 mx-auto space-y-6">

      {/* Identity Plate */}
      <div className="relative bg-gisviz-card border border-gisviz-border shadow-md rounded-sm plate-enter overflow-hidden">
        
        {/* Cartographic Registration Marks
        <div className="reg-mark reg-tl"></div>
        <div className="reg-mark reg-tr"></div>
        <div className="reg-mark reg-bl"></div>
        <div className="reg-mark reg-br"></div> */}

        {/* Ambient Topographic Header */}
        <div className="h-32 bg-gradient-to-r from-gisviz-canvas via-gisviz-canvas to-gisviz-accent-soft border-b border-gisviz-border relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(var(--color-gisviz-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-gisviz-grid) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        </div>

        <div className="px-8 pb-8 pt-4 relative flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16">
          <div className="w-24 h-24 rounded-xl border-4 border-gisviz-card bg-gisviz-canvas overflow-hidden shadow-sm shrink-0 z-10">
             <img src={profileData.avatar} alt={profileData.handle} className="w-full h-full object-cover" />
          </div>

          <div className="flex-1 space-y-1 z-10">
            <h1 className="text-3xl font-display font-bold text-gisviz-ink">
              @{profileData.handle}
            </h1>
            <p className="text-sm font-mono text-gisviz-ink-soft flex items-center gap-4">
              <span>{profileData.role}</span>
              <span className="w-1 h-1 rounded-full bg-gisviz-border"></span>
              <span>{profileData.location}</span>
            </p>
          </div>

          <div className="flex gap-4 font-mono text-sm z-10 w-full sm:w-auto mt-4 sm:mt-0 justify-between sm:justify-end border-t sm:border-t-0 border-gisviz-border pt-4 sm:pt-0">
            <div className="text-center sm:text-right">
              <p className="text-2xl font-bold text-gisviz-ink">{profileData.publications}</p>
              <p className="text-xs text-gisviz-ink-soft uppercase tracking-wider">Publications</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-2xl font-bold text-gisviz-ink">{profileData.followers}</p>
              <p className="text-xs text-gisviz-ink-soft uppercase tracking-wider">Followers</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-2xl font-bold text-gisviz-ink">{profileData.following}</p>
              <p className="text-xs text-gisviz-ink-soft uppercase tracking-wider">Following</p>
            </div>
          </div>
        </div>

        {/* Profile Action Bar */}
        <div className="bg-gisviz-canvas/50 border-t border-gisviz-border px-8 py-3 flex justify-between items-center">
           <div className="flex gap-6 font-mono text-sm">
             <button 
               onClick={() => setActiveTab('publications')}
               className={`pb-1 border-b-2 transition-colors ${activeTab === 'publications' ? 'border-gisviz-accent text-gisviz-ink font-bold' : 'border-transparent text-gisviz-ink-soft hover:text-gisviz-ink'}`}
             >
               Spatial Data
             </button>
             <button 
               onClick={() => setActiveTab('saved')}
               className={`pb-1 border-b-2 transition-colors ${activeTab === 'saved' ? 'border-gisviz-accent text-gisviz-ink font-bold' : 'border-transparent text-gisviz-ink-soft hover:text-gisviz-ink'}`}
             >
               Saved Regions
             </button>
           </div>

           {!isOwnProfile && (
             <button className="flex items-center gap-2 bg-gisviz-accent text-white px-4 py-1.5 rounded-md hover:bg-opacity-90 transition-all font-mono text-xs shadow-sm">
               <Users size={14} /> Follow Analyst
             </button>
           )}
        </div>
      </div>

      {/* Publications Grid */}
      <div className="flex justify-between items-center mb-4 mt-8">
        <h2 className="text-lg font-display font-bold text-gisviz-ink flex items-center gap-2">
          <Activity size={18} className="text-gisviz-accent" />
          {activeTab === 'publications' ? 'Recent Publications' : 'Saved Bookmarks'}
        </h2>
        <button className="text-xs font-mono text-gisviz-ink-soft hover:text-gisviz-ink flex items-center gap-1 border border-gisviz-border px-3 py-1.5 rounded-md bg-gisviz-card">
          <Filter size={14} /> Filter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockPublications.map((pub) => (
          <div key={pub.id} className="bg-gisviz-card border border-gisviz-border p-5 rounded-sm hover:border-gisviz-accent transition-colors group cursor-pointer shadow-sm flex flex-col justify-between h-48 plate-enter">
            <div>
              <div className="flex justify-between items-start mb-2">
                <MapIcon className="text-gisviz-ink-soft group-hover:text-gisviz-accent transition-colors" size={20} />
                <ExternalLink className="text-gisviz-border group-hover:text-gisviz-ink-soft transition-colors opacity-0 group-hover:opacity-100" size={16} />
              </div>
              <h3 className="font-bold text-gisviz-ink leading-tight">{pub.title}</h3>
              <div className="flex gap-2 mt-3 flex-wrap">
                {pub.categories.map(cat => (
                  <span key={cat} className="text-[10px] font-mono bg-gisviz-canvas border border-gisviz-border px-2 py-0.5 rounded-full text-gisviz-ink-soft">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex justify-between items-center border-t border-gisviz-border pt-3 mt-4 text-xs font-mono text-gisviz-ink-soft">
              <span>{pub.date}</span>
              <div className="flex gap-3">
                <span>{pub.likes} Likes</span>
                <span>{pub.comments} Com</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}