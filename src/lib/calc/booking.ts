// Direct port of v1's booking-link builders (reference-v1-app.html:1580-1639).
import type { Slot } from "@/data/slots";
import { nice } from "./dates";

const enc = encodeURIComponent;

export function timingTip(s: Slot): string {
  if (s.id === "sSP")
    return "🍀 St. Patrick's Day spikes Dublin prices hard — book flights AND hostels 2–3 months out (by mid-December). Dublin dorms hit €60+ and sell out first.";
  if (s.kind === "break")
    return "Spring break is peak season. Lock your outbound + return flights and the first/last-city beds 2–3 months ahead. Spain's high-speed AVE trains are cheapest the day the timetable opens (~2 months prior) — buy early.";
  if (s.kind === "post")
    return "Late-May post-finals trends warm and pricey for islands. Book Greek/beach flights and any ferries 6–8 weeks out; Santorini & Mykonos stays sell out first.";
  if (s.kind === "special")
    return "Midweek trip — Tuesday/Wednesday flights are usually the cheapest of the week. Aim to book ~4–6 weeks ahead.";
  return "Weekend citybreak: budget flights are usually cheapest ~4–6 weeks out and climb steeply in the final 2 weeks. Midweek or early-Saturday departures save the most.";
}

export function googleFlightsUrl(from: string, to: string, date?: Date | null): string {
  return `https://www.google.com/travel/flights?q=${enc(
    "Flights from " + from + " to " + to + (date ? " on " + nice(date) : "")
  )}`;
}

export function hostelworldUrl(city: string, checkIn: string, checkOut: string): string {
  return `https://www.hostelworld.com/search?search_keywords=${enc(city)}&from=${checkIn}&to=${checkOut}`;
}

export function bookingComUrl(city: string, checkIn: string, checkOut: string): string {
  return `https://www.booking.com/searchresults.html?ss=${enc(city)}&checkin=${checkIn}&checkout=${checkOut}`;
}

export function airbnbUrl(city: string, checkIn: string, checkOut: string): string {
  return `https://www.airbnb.com/s/${enc(city)}/homes?checkin=${checkIn}&checkout=${checkOut}`;
}

export function getYourGuideUrl(query: string): string {
  return `https://www.getyourguide.com/s/?q=${enc(query)}`;
}

export function viatorUrl(city: string): string {
  return `https://www.viator.com/search/${enc(city)}`;
}

export function tiqetsUrl(query: string): string {
  return `https://www.tiqets.com/en/search/?q=${enc(query)}`;
}

export function mapsBestDishUrl(dish: string, city: string): string {
  return `https://www.google.com/maps/search/${enc("best " + dish + " " + city)}`;
}

export const STATIC_LINKS = {
  skyscanner: "https://www.skyscanner.com/",
  kiwi: "https://www.kiwi.com/",
  ryanair: "https://www.ryanair.com/",
  wizzair: "https://wizzair.com/",
  omio: "https://www.omio.com/",
  trainline: "https://www.thetrainline.com/",
  flixbus: "https://www.flixbus.com/",
};
