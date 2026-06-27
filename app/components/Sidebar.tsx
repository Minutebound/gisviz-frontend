"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { gisvizApi } from "../../services/api";
import {
  Home,
  User as UserIcon,
  Ticket,
  Bookmark,
  LogOut,
  MapPin
} from "lucide-react";
import { useUserResidence } from "@/hooks/useUserResidence";

export default function Sidebar() {
  const { user, logout, isLoggedIn } = useAuth() as any;
  const pathname = usePathname();
  const [profileData, setProfileData] = useState<any>(null);
  const { residenceState } = useUserResidence();

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

  // Fetch real data from the DB
  useEffect(() => {
    if (isLoggedIn) {
      travelApi
        .getProfile()
        .then((data) => setProfileData(data))
        .catch((err) => console.error("Sidebar failed to load profile", err));
    } else {
      setProfileData(null);
    }
  }, [isLoggedIn]);

  const avatarUrl = profileData?.profile_picture_url;
  const displayName =
    profileData?.full_name || (typeof user === "string" ? user : user?.name) || "Traveler";

  return (
    <aside className="w-72 h-screen sticky top-0 bg-theme-white border-r border-theme-secondary/10 flex flex-col shadow-sm z-50">
      
      {/* 1. DB Profile Info Header */}
      <div className="p-6 border-b border-theme-secondary/10 bg-theme-secondary/5 flex flex-col items-center justify-center gap-3">
        {isLoggedIn ? (
          <>
            {avatarUrl ? (
              <img
                src={avatarUrl.startsWith("http") ? avatarUrl : `${API_BASE_URL}${avatarUrl}`}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border-4 border-theme-white shadow-md"
              />
            ) : (
              <div className="bg-theme-primary/10 p-5 rounded-full shadow-inner">
                <UserIcon size={36} className="text-theme-primary" />
              </div>
            )}
            <div className="flex flex-col items-center text-center mt-2">
              <span className="font-black text-xl text-theme-secondary leading-tight truncate w-56">
                {displayName}
              </span>
              <span className="font-bold text-theme-primary uppercase tracking-widest mt-1.5 text-xs bg-theme-primary/10 px-3 py-1 rounded-full shadow-sm">
                ID: {profileData?.unique_travel_id || "Loading..."}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="bg-theme-primary/10 p-5 rounded-full shadow-inner">
              <UserIcon size={36} className="text-theme-primary" />
            </div>
            <p className="font-black text-theme-secondary/50 text-sm uppercase tracking-widest">
              Not Logged In
            </p>
          </div>
        )}
      </div>

      {/* 2. Navigation Links */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        <Link
          href="/"
          className={`group flex items-center gap-4 px-4 py-3.5 font-bold tracking-wide rounded-[16px] transition-all ${
            pathname === "/"
              ? "bg-theme-primary/10 text-theme-primary"
              : "text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary/5"
          }`}
        >
          <Home
            size={22}
            className={
              pathname === "/"
                ? "text-theme-primary"
                : "text-theme-secondary/50 group-hover:text-theme-primary transition-colors"
            }
          />
          Home
        </Link>

        {isLoggedIn ? (
          <>
            <Link
              href="/profile"
              className={`group flex items-center gap-4 px-4 py-3.5 font-bold tracking-wide rounded-[16px] transition-all ${
                pathname === "/profile"
                  ? "bg-theme-primary/10 text-theme-primary"
                  : "text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary/5"
              }`}
            >
              <UserIcon
                size={22}
                className={
                  pathname === "/profile"
                    ? "text-theme-primary"
                    : "text-theme-secondary/50 group-hover:text-theme-primary transition-colors"
                }
              />
              Profile Settings
            </Link>

            <Link
              href="/bookings"
              className={`group flex items-center gap-4 px-4 py-3.5 font-bold tracking-wide rounded-[16px] transition-all ${
                pathname === "/bookings"
                  ? "bg-theme-primary/10 text-theme-primary"
                  : "text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary/5"
              }`}
            >
              <Ticket
                size={22}
                className={
                  pathname === "/bookings"
                    ? "text-theme-primary"
                    : "text-theme-secondary/50 group-hover:text-theme-primary transition-colors"
                }
              />
              My Bookings
            </Link>

            <Link
              href="/savedItineraries"
              className={`group flex items-center gap-4 px-4 py-3.5 font-bold tracking-wide rounded-[16px] transition-all ${
                pathname === "/savedItineraries"
                  ? "bg-theme-primary/10 text-theme-primary"
                  : "text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary/5"
              }`}
            >
              <Bookmark
                size={22}
                className={
                  pathname === "/savedItineraries"
                    ? "text-theme-primary"
                    : "text-theme-secondary/50 group-hover:text-theme-primary transition-colors"
                }
              />
              Saved Itineraries
            </Link>
          </>
        ) : (
          <Link
            href="/auth"
            className="group flex items-center gap-4 px-4 py-3.5 font-bold tracking-wide text-theme-white bg-theme-primary hover:bg-theme-primary/90 rounded-[16px] transition-all shadow-md active:scale-95"
          >
            <UserIcon size={22} />
            Login / Sign Up
          </Link>
        )}
      </div>

      {/* 3. Location Display (Optional, based on Navbar functionality) */}
      <div className="px-6 py-4 bg-theme-secondary/5 mx-4 mb-4 rounded-[16px] border border-theme-secondary/10 flex items-center gap-3 shadow-sm">
         <MapPin size={20} className="text-theme-primary shrink-0" />
         <div className="flex flex-col overflow-hidden">
           <span className="text-[10px] font-black uppercase tracking-widest text-theme-secondary/50">Current Locale</span>
           <span className="font-bold text-sm text-theme-secondary truncate">{residenceState || "Not Set"}</span>
         </div>
      </div>

      {/* 4. Logout / Footer */}
      {isLoggedIn && (
        <div className="p-4 border-t border-theme-secondary/10">
          <button
            onClick={logout}
            className="group w-full flex items-center gap-4 px-4 py-3.5 font-bold tracking-wide text-red-500 hover:bg-red-50 hover:text-red-600 rounded-[16px] transition-all text-left"
          >
            <LogOut
              size={22}
              className="text-red-400 group-hover:text-red-500 transition-colors"
            />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
}