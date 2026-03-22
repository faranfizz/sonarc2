import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle } from "lucide-react";

export default function FeedbackForm() {
  const [state, setState] = useState<"idle"|"sending"|"sent"|"error">("idle");
  const [form, setForm] = useState({ name: "", email: "", type: "feedback", message: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setState("sending");
    try {
      const res = await fetch("https://formspree.io/f/mojkzybd", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          type: form.type,
          message: form.message,
          _subject: `Sonarc ${form.type} — ${form.name || "Anonymous"}`,
        }),
      });
      if (res.ok) setState("sent");
      else setState("error");
    } catch {
      setState("error");
    }
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    color: "#FFFFFF",
    outline: "none",
    width: "100%",
    padding: "10px 14px",
    fontSize: "14px",
    transition: "border-color 0.2s",
  } as React.CSSProperties;

  return (
    <AnimatePresence mode="wait">
      {state === "sent" ? (
        <motion.div key="sent"
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center text-center py-12 px-8 rounded-2xl"
          style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}
        >
          <CheckCircle className="w-12 h-12 text-emerald-400 mb-4" />
          <h3 className="font-display font-black text-white text-xl mb-2" style={{ letterSpacing: "-0.04em" }}>
            Thank you! 🙏
          </h3>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Your feedback has been received. We read every single one and will get back to you if you left an email.
          </p>
          <button onClick={() => { setState("idle"); setForm({ name:"", email:"", type:"feedback", message:"" }); }}
            className="mt-6 text-xs font-semibold px-4 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
          >Send another</button>
        </motion.div>
      ) : (
        <motion.form key="form" onSubmit={submit}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="space-y-4 p-6 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Type selector */}
          <div>
            <label className="text-[10px] font-black tracking-[0.15em] uppercase mb-2 block" style={{ color: "rgba(255,255,255,0.35)" }}>
              What is this about?
            </label>
            <div className="flex gap-2">
              {[
                { val: "feedback", label: "💬 Feedback" },
                { val: "bug", label: "🐛 Bug report" },
                { val: "feature", label: "✨ Feature idea" },
              ].map(t => (
                <button key={t.val} type="button"
                  onClick={() => setForm(f => ({ ...f, type: t.val }))}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                  style={form.type === t.val
                    ? { background: "rgba(124,58,237,0.18)", color: "#A78BFA", border: "1px solid rgba(124,58,237,0.35)" }
                    : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }
                  }
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Name + Email row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black tracking-[0.15em] uppercase mb-1.5 block" style={{ color: "rgba(255,255,255,0.35)" }}>Name</label>
              <input type="text" placeholder="Your name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "rgba(124,58,237,0.5)"}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>
            <div>
              <label className="text-[10px] font-black tracking-[0.15em] uppercase mb-1.5 block" style={{ color: "rgba(255,255,255,0.35)" }}>Email <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>(optional)</span></label>
              <input type="email" placeholder="For our reply" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "rgba(124,58,237,0.5)"}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-[10px] font-black tracking-[0.15em] uppercase mb-1.5 block" style={{ color: "rgba(255,255,255,0.35)" }}>Your message *</label>
            <textarea required placeholder="Tell us what you think, what's broken, or what you'd love to see..." 
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={4}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }}
              onFocus={e => (e.target as HTMLTextAreaElement).style.borderColor = "rgba(124,58,237,0.5)"}
              onBlur={e => (e.target as HTMLTextAreaElement).style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>

          {state === "error" && (
            <p className="text-sm text-red-400">Something went wrong. Please try again.</p>
          )}

          <motion.button type="submit" disabled={state === "sending" || !form.message.trim()}
            whileHover={{ scale: 1.02, boxShadow: "0 0 24px rgba(124,58,237,0.5)" }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg,#7C3AED,#06B6D4)",
              opacity: (!form.message.trim() || state === "sending") ? 0.5 : 1,
              boxShadow: "0 0 16px rgba(124,58,237,0.35)",
            }}
          >
            {state === "sending"
              ? <><motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}/> Sending...</>
              : <><Send className="w-4 h-4"/>Send feedback</>
            }
          </motion.button>

          <p className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
            Responses go directly to the Sonarc team · We reply within 48 hours
          </p>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
