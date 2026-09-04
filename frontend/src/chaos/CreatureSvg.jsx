// Renders the user-supplied creature images (placed in /public/creatures).
// "green" (friendly, click for +1 life) -> omnom.webp
// "purple" (dangerous, click for -1 life) -> big.webp
export default function CreatureImage({ variant = "green" }) {
  const src = variant === "purple" ? "/creatures/big.webp" : "/creatures/omnom.webp";
  const alt = variant === "purple" ? "dangerous creature" : "friendly creature";
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
    />
  );
}
