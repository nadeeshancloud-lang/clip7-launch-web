import type { ReactNode } from 'react';
import { Clipboard, Layers, Download, ArrowRight, Play, Globe } from 'lucide-react';

type HomeProps = {
  downloader: ReactNode;
  remaining: number;
  appPromo: ReactNode;
  faq: ReactNode;
};

export default function HomeContent({ downloader, remaining, appPromo, faq }: HomeProps) {
  return (
    <>
      <section className="download-home wrap">
        <div className="home-heading">
          <h1>Download videos.<br /><span>Save your music.</span></h1>
          <p>Paste a link, choose video or audio, and download your file.</p>
        </div>

        <div className="download-workspace">
          {downloader}
          <div className="download-allowance">
            <span><strong>{remaining} downloads</strong> available every 48 hours</span>
            <a href="/account">View your allowance <ArrowRight size={18} /></a>
          </div>
        </div>

        <div className="platforms" aria-label="Media source examples">
          <span className="platform-name"><span className="platform-symbol youtube"><Play size={17} fill="currentColor" /></span>YouTube</span>
          <span className="platform-name"><span className="platform-symbol facebook">f</span>Facebook</span>
          <span className="platform-name"><span className="platform-symbol instagram">◎</span>Instagram</span>
          <span className="platform-name"><span className="platform-symbol tiktok">♪</span>TikTok</span>
          <span className="platform-name"><Globe size={22} />Other sites</span>
        </div>
        <p className="source-availability">Available formats depend on the source. <a href="/help">See download help</a></p>
      </section>

      <section className="how-section wrap" aria-labelledby="how-heading">
        <div className="section-heading">
          <h2 id="how-heading">Three steps to download</h2>
          <a href="/help" className="inline-link">Need help? <ArrowRight size={18} /></a>
        </div>
        <div className="how-grid">
          {[
            { icon: Clipboard, number: '1', title: 'Paste your link', text: 'Copy a public media link and paste it into Clip7.' },
            { icon: Layers, number: '2', title: 'Choose your format', text: 'Pick an available video or audio option.' },
            { icon: Download, number: '3', title: 'Download your file', text: 'Sign in with Google and start your download.' },
          ].map(({ icon: Icon, number, title, text }) => (
            <article className="how-item" key={number}>
              <span className="how-number">{number}</span>
              <div><Icon size={25} /><h3>{title}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      {appPromo}
      {faq}
    </>
  );
}
