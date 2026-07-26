import Image from "next/image";
import { TRIP_PHOTOS } from "@/data/tripPhotos";
import ImagePlaceholder from "./ImagePlaceholder";

/** Renders a trip's fetched Unsplash photo (see scripts/fetch-photos.mjs and
 * src/data/tripPhotos.ts), or a tasteful placeholder with the trip name if
 * none was fetched -- never a broken image. */
export default function TripPhoto({
  tripId,
  name,
  country,
  ratio = "aspect-[4/3]",
  className = "",
  sizes,
  priority,
}: {
  tripId: string;
  name: string;
  country: string;
  ratio?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const photo = TRIP_PHOTOS[tripId];

  if (!photo) {
    return <ImagePlaceholder ratio={ratio} className={className} label={name} />;
  }

  return (
    <div className={`relative overflow-hidden rounded-[calc(var(--radius-card)-4px)] ${ratio} ${className}`}>
      <Image
        src={photo.file}
        alt={`${name}, ${country}`}
        fill
        sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"}
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}
