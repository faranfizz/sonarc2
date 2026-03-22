import { motion } from "framer-motion";

export const SonarcLogoHorizontal = ({ onClick }: { onClick?: () => void }) => (
  <motion.button onClick={onClick} whileHover={{ opacity: 0.8 }} whileTap={{ scale: 0.97 }}
    className="font-display font-black" style={{ fontSize: "22px", letterSpacing: "-0.065em", lineHeight: 1 }}
  >
    <span style={{ color: "#FFFFFF" }}>SON</span>
    <span style={{ background: "linear-gradient(135deg,#A78BFA,#22D3EE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>ARC</span>
  </motion.button>
);

export const SonarcLogoCentered = () => (
  <div className="font-display font-black text-center" style={{ fontSize: "clamp(40px,6vw,72px)", letterSpacing: "-0.065em", lineHeight: 1 }}>
    <span style={{ color: "#FFFFFF" }}>SON</span>
    <span style={{ background: "linear-gradient(135deg,#A78BFA,#22D3EE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>ARC</span>
  </div>
);

export default SonarcLogoHorizontal;
