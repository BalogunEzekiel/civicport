import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import React, { useEffect } from "react";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export default function IssueMap({ reports, onOpen }) {
  const points = reports.filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
  const center = points.length ? [points[0].latitude, points[0].longitude] : [6.5244, 3.3792];

  return (
    <MapContainer center={center} zoom={11} scrollWheelZoom={false} className="map">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map(r => (
        <Marker key={r.reference} position={[r.latitude, r.longitude]} icon={icon}>
          <Popup>
            <strong>{r.title}</strong><br />
            {r.locationLabel}<br />
            <button className="popup-link" onClick={() => onOpen(r.reference)}>View report</button>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
