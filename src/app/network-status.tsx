"use client";
import { useEffect, useState } from "react";
export function NetworkStatus(){const [offline,setOffline]=useState(false);useEffect(()=>{const update=()=>setOffline(!navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update)}},[]);return offline?<div className="offline" role="status">You’re offline. Showing saved research; changes will wait until you reconnect.</div>:null}
