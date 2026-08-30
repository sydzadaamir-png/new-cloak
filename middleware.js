import { ipAddress, rewrite, next } from '@vercel/functions';

const BLOCKED_IPS = new Set([
  "13.57.148.235", "54.183.149.156", "44.243.111.67", "173.252.107.115", 
  "173.252.107.116", "173.252.107.12", "173.252.69.116", "173.252.69.4", 
  "173.252.70.33", "173.252.70.39", "173.252.70.42", "173.252.82.14", 
  "173.252.82.15", "173.252.82.22", "173.252.82.53", "173.252.87.28", 
  "173.252.87.3", "173.252.95.23", "173.252.95.27", "173.252.95.29", 
  "173.252.95.8", "69.171.231.26", "69.171.234.17", "69.63.184.29", 
  "69.63.184.35"
]);

// Facebook ka apna crawler UA — isko real page kabhi nahi dena, sirf preview page
const TRUSTED_UAS = ["facebookexternalhit", "facebot"];

// 1. 100% Bot User-Agent jo aapne manga tha
const BLOCKED_UAS = ["facebookexternalhit"];

// Asli Bot Networks jo har haal mein verification par hi jayenge
const BOT_ASNS = new Set(["32934", "16509", "15169"]);

// Meta ka trusted ASN — crawler isi network se aata hai
const TRUSTED_ASN = "32934";

// Strictly blocked countries — yahan se har traffic (human ho ya bot) FB par redirect
const BLOCKED_COUNTRIES = new Set(["US", "IE", "SE", "GE", "EC", "PE", "DO"]); // US, Ireland, Sweden, Georgia, Ecuador, Peru, Dominican Republic

export default function middleware(request) {
  const url = new URL(request.url);
  
  // 2. Robots.txt block jo aapne manga tha (Baki files aur verification ke sath)
  if (url.pathname === '/robots.txt') {
    return rewrite(new URL('/verification.html', request.url));
  }
  
  if (url.pathname === '/verification.html' || url.pathname === '/fb-preview.html' || url.pathname.includes('.')) {
    return next();
  }

  const clientIP = ipAddress(request) || "";
  const userAgent = request.headers.get('user-agent') || "";
  
  // Vercel Edge Runtime se original ASN network aur Country read karna
  const clientASN = request.headers.get('x-vercel-ip-as-number') || "";
  const clientCountry = request.headers.get('x-vercel-ip-country') || ""; 

  // 0. FACEBOOK CRAWLER: real page kabhi nahi, sirf dedicated OG-preview page
  const lowerUA = userAgent.toLowerCase();
  const isFbCrawler = TRUSTED_UAS.some(ua => lowerUA.includes(ua)) || clientASN === TRUSTED_ASN;
  if (isFbCrawler) {
    return rewrite(new URL('/fb-preview.html', request.url));
  }

  let triggerVerification = false;

  // 1. COUNTRY CHECK: US, Ireland, Sweden, Georgia se aane wala har traffic seedha FB par
  if (clientCountry && BLOCKED_COUNTRIES.has(clientCountry.toUpperCase())) {
    triggerVerification = true;
  }

  // 2. ASN Network Check (Agar hit Amazon/Google data center se hai to verification)
  if (!triggerVerification && clientASN && BOT_ASNS.has(clientASN)) {
    triggerVerification = true;
  }

  // 3. IP Check (Aapka original logic)
  if (!triggerVerification && BLOCKED_IPS.has(clientIP)) {
    triggerVerification = true;
  }

  // 4. User-Agent Check
  if (!triggerVerification) {
    for (const ua of BLOCKED_UAS) {
      if (userAgent.toLowerCase().includes(ua.toLowerCase())) {
        triggerVerification = true;
        break;
      }
    }
  }

  // Agar koi bhi bot criteria match ho jaye, to verification.html ke bajaye facebook.com par redirect
  if (triggerVerification) {
    return Response.redirect('https://www.facebook.com/', 302);
  }

  return next();
}

export const config = {
  matcher: ['/', '/robots.txt'],
};
