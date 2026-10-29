// Footer shown at the bottom of every page.
import { Repeat2 } from "lucide-react";

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span className="logo">
          <span className="logo-mark"><Repeat2 size={14} strokeWidth={2.5} /></span>
          RentLoop
        </span>
        <span>A student project. Deposits are recorded only, no real payments are made.</span>
      </div>
    </footer>
  );
}

export default Footer;
