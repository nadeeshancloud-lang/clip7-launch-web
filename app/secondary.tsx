'use client';

import { useState, type ReactNode, type KeyboardEvent } from 'react';
import {
  ArrowRight, ArrowUpRight, ArrowDown, Check, CheckCircle2, Link as LinkIcon,
  Music2, ShieldCheck, Headphones, Globe, FolderDown, User, LogOut,
  Monitor, Smartphone, Clock, History, RotateCcw, Mail, Download,
} from 'lucide-react';
import { ApkButton, AppPromo, FaqSection, appIcon, sizeText } from './clip7';
import releaseInfo from './release-info.json';

export const faqs: [string, string][] = [
  ['How do I download a video or song?', 'Copy the original media link, paste it into Clip7, and choose Get download options. Select an available video or audio format, sign in with Google, then download. Only save media you own or have permission to download.'],
  ['Does checking a link use a download?', 'No. Pasting links, checking media and viewing formats are free. One credit is used when a file transfer successfully starts.'],
  ['When does my download allowance reset?', 'Your full allowance returns 48 hours after the first download in your window: 25 on mobile or 35 on desktop. The allowance stays the same for that window if you switch devices.'],
  ['What is included in the Android app?', 'Clip Sevan includes a browser, media player, background audio and a download manager. This release is offered free, with unlimited downloads and no ads.'],
  ['Why is my link not working?', 'The source may require verification, restrict access, or no longer offer the media. Private, protected and DRM media are not supported. Try the original public link or another available format.'],
  ['Can I use Clip7 on iPhone or PC?', 'Yes. Use the website in your phone, tablet or desktop browser. The Clip Sevan APK is for Android phones and tablets only.'],
];

type Profile = { displayName?: string; email?: string; photoURL?: string };
type Quota = { limit?: number; remaining?: number; resetAt?: number | null };
type DownloadRecord = {
  id?: string;
  title?: string;
  formatLabel?: string;
  formatId?: string;
  format_id?: string;
  format?: string;
  status?: string;
  createdAt?: number;
  created_at?: number;
};
type SecondaryPageProps = {
  page: string;
  profile: Profile | null;
  mobile: boolean;
  quota: Quota | null;
  records: DownloadRecord[];
  googleButton: ReactNode;
  loadHistory: () => void;
  signOut: () => void;
  manageConsent: () => void;
};

function Intro({ title, copy }: { title: ReactNode; copy: string }) {
  return (
    <section className="page-intro wrap">
      <h1>{title}</h1>
      <p>{copy}</p>
    </section>
  );
}

export function ReleaseDetails() {
  return (
    <section className="release-details wrap" id="release">
      <div>
        <h2>App download details</h2>
        <p className="release-notice">Testing beta. This APK uses an Android Debug certificate; a release-signed build is required for the public launch.</p>
      </div>
      <dl>
        <div><dt>Version</dt><dd>{releaseInfo.version}</dd></div>
        <div><dt>Download size</dt><dd>{sizeText(releaseInfo.size)}</dd></div>
        <div><dt>Requires</dt><dd>{releaseInfo.minAndroid}</dd></div>
        <div><dt>Package</dt><dd>{releaseInfo.package}</dd></div>
        <div className="checksum"><dt>SHA-256 checksum</dt><dd>{releaseInfo.sha256}</dd></div>
      </dl>
      <details className="install-instructions">
        <summary>How to install the Android APK</summary>
        <ol>
          <li>Download the APK on your Android phone.</li>
          <li>Open the file from your browser’s Downloads.</li>
          <li>Follow Android’s installation prompts. Only allow this browser to install apps if you trust the release.</li>
        </ol>
        <p>Keep Android’s security checks enabled.</p>
      </details>
    </section>
  );
}

const screenshots = [
  { file: 'app-home.webp', name: 'Discover', title: 'Find videos and music', description: 'Browse the discover feed, search for media, or paste a link.' },
  { file: 'app-sites.webp', name: 'Browser', title: 'Browse your favorite sites', description: 'Open supported sources in Clip Sevan’s built-in browser.' },
  { file: 'app-video.webp', name: 'Video', title: 'Choose a video format', description: 'See the formats and file sizes available from the original source.' },
  { file: 'app-audio.webp', name: 'Audio', title: 'Save audio for listening', description: 'Choose an available audio format and continue listening in the background.' },
  { file: 'app-account.webp', name: 'Your space', title: 'Manage your app', description: 'Keep your settings, media tools and download activity together.' },
];

function recordDate(record: DownloadRecord) {
  const timestamp = record.createdAt ?? record.created_at;
  if (!timestamp) return 'Date unavailable';
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? 'Date unavailable' : date.toLocaleString();
}

function recordStatus(status?: string) {
  const labels: Record<string, string> = {
    started: 'Transfer started', reserved: 'Preparing', failed: 'Failed',
    canceled: 'Canceled', expired: 'Expired',
  };
  return labels[status || ''] || status || 'Transfer started';
}

export function SecondaryPage({
  page, profile, mobile, quota, records, googleButton,
  loadHistory, signOut, manageConsent,
}: SecondaryPageProps) {
  const [screen, setScreen] = useState(0);
  const limit = quota?.limit ?? (mobile ? 25 : 35);
  const remaining = quota?.remaining ?? limit;
  const screenshot = screenshots[screen];

  function navigateScreens(event: KeyboardEvent<HTMLDivElement>) {
    let next = screen;
    if (event.key === 'ArrowRight') next = (screen + 1) % screenshots.length;
    else if (event.key === 'ArrowLeft') next = (screen + screenshots.length - 1) % screenshots.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = screenshots.length - 1;
    else return;
    event.preventDefault();
    setScreen(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  }

  if (page === 'app') {
    return (
      <>
        <section className="app-page-hero wrap">
          <div>
            <h1>Clip Sevan<br />for Android</h1>
            <p className="hero-description">Download videos and music, browse supported sites, and play your saved media in one app.</p>
            <div className="app-benefits dark">
              <span><Check size={20} />100% free</span>
              <span><Check size={20} />Unlimited downloads</span>
              <span><Check size={20} />No ads</span>
            </div>
            <ApkButton />
            <a href="#release" className="inline-link">Version & installation details <ArrowDown size={18} /></a>
          </div>
          <div className="app-hero-image app-install-card">
            <div className="install-card-head">
              <img src={appIcon} alt="Clip Sevan app icon" />
              <div><h2>Clip Sevan</h2><p>{releaseInfo.version}</p></div>
            </div>
            <div className="install-card-facts">
              <span><Smartphone size={20} />{releaseInfo.minAndroid}</span>
              <span><Download size={20} />{sizeText(releaseInfo.size)}</span>
            </div>
            <ul className="install-card-list">
              <li><Globe size={22} /><span>1000+ site support</span></li>
              <li><Headphones size={22} /><span>Background audio playback</span></li>
              <li><FolderDown size={22} /><span>Built-in download manager</span></li>
            </ul>
            <span className="pill">Android testing beta</span>
          </div>
        </section>

        <section className="app-explore wrap">
          <div className="section-heading"><h2>See the app</h2><p>Explore the screens and features.</p></div>
          <div className="screen-tabs" role="tablist" aria-label="App features" onKeyDown={navigateScreens}>
            {screenshots.map((item, index) => (
              <button
                id={`app-screen-tab-${index}`}
                key={item.name}
                role="tab"
                aria-selected={screen === index}
                aria-controls="app-screen-panel"
                tabIndex={screen === index ? 0 : -1}
                className={screen === index ? 'active' : ''}
                onClick={() => setScreen(index)}
              >{item.name}</button>
            ))}
          </div>
          <div className="explore-panel" id="app-screen-panel" role="tabpanel" aria-labelledby={`app-screen-tab-${screen}`}>
            <div className="explore-copy">
              <h3>{screenshot.title}</h3>
              <p>{screenshot.description}</p>
              <ul className="feature-checks">
                <li><CheckCircle2 />Video and audio downloads</li>
                <li><CheckCircle2 />Browser and media player</li>
                <li><CheckCircle2 />Background audio</li>
              </ul>
            </div>
            <div className="screen-image" key={screen}>
              <img src={`/assets/${screenshot.file}`} alt={`${screenshot.name} screen in Clip Sevan`} loading="lazy" />
            </div>
          </div>
        </section>
        <ReleaseDetails />
        <FaqSection />
      </>
    );
  }

  if (page === 'features') {
    const features = [
      { Icon: LinkIcon, title: 'Paste a link', copy: 'Check an HTTPS media link and see the download options available from the source.', where: 'Web downloader' },
      { Icon: Music2, title: 'Video or audio', copy: 'Choose a verified format. File sizes are shown when the source reports them.', where: 'Web downloader' },
      { Icon: ShieldCheck, title: 'Free download allowance', copy: '25 downloads on mobile or 35 on desktop. Your allowance refreshes every 48 hours.', where: 'Web downloader' },
      { Icon: Headphones, title: 'Background playback', copy: 'Keep listening to audio when you leave the player screen.', where: 'Android app' },
      { Icon: Globe, title: 'Built-in browser', copy: 'Browse supported sites without switching between apps.', where: 'Android app' },
      { Icon: FolderDown, title: 'Download manager', copy: 'Keep your downloads, saved media and playback tools together.', where: 'Android app' },
    ];
    return (
      <>
        <Intro title="Everything you can do with Clip7" copy="Use the website for a quick download, or get the Android app for more features." />
        <section className="feature-grid wrap">
          {features.map(({ Icon, title, copy, where }) => (
            <article className="feature-card" key={title}>
              <span className="step-icon"><Icon size={28} /></span>
              <small>{where}</small><h3>{title}</h3><p>{copy}</p>
            </article>
          ))}
        </section>
        <section className="comparison wrap">
          <div><h2>Web or Android?</h2><p>Choose the experience that works for you.</p></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Feature</th><th>Clip7 website</th><th>Clip Sevan app</th></tr></thead>
              <tbody>
                <tr><td>Price</td><td>Free</td><td>Free</td></tr>
                <tr><td>Downloads</td><td>25 mobile / 35 desktop per 48h</td><td>Unlimited</td></tr>
                <tr><td>Advertising</td><td>No ads</td><td>No ads</td></tr>
                <tr><td>Background audio</td><td>—</td><td>Included</td></tr>
                <tr><td>Built-in browser</td><td>—</td><td>Included</td></tr>
                <tr><td>Installation</td><td>Not required</td><td>Android APK</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <AppPromo />
      </>
    );
  }

  if (page === 'account') {
    return (
      <>
        <Intro title="Your account" copy="Sign in to download media and manage your web allowance." />
        <section className="account-layout wrap">
          <div className="account-card">
            {profile ? (
              <>
                <div className="account-avatar">{profile.photoURL ? <img src={profile.photoURL} alt="Your profile" referrerPolicy="no-referrer" /> : <User size={36} />}</div>
                <h2>{profile.displayName || 'Your account'}</h2><p>{profile.email}</p>
                <span className="signed-in"><CheckCircle2 size={20} />Signed in with Google</span>
                <button className="button outline" onClick={signOut}><LogOut size={20} />Sign out</button>
              </>
            ) : (
              <>
                <span className="step-icon"><User size={28} /></span>
                <h2>Sign in with Google</h2>
                <p>Use your free web downloads and view your download history.</p>
                {googleButton}
                <small>Clip7 does not receive your Google password.</small>
              </>
            )}
          </div>
          <div className="quota-card">
            <div className="tool-top"><h2>Your downloads</h2>{mobile ? <Smartphone size={24} /> : <Monitor size={24} />}</div>
            <div className="quota-number">{remaining}<span>/ {limit}</span></div>
            <h3>{profile ? 'downloads remaining' : 'free downloads per 48 hours'}</h3>
            <div className="quota-bar"><div style={{ width: `${Math.min(100, remaining / limit * 100)}%` }} /></div>
            <p><Clock size={20} />{quota?.resetAt ? `Refills ${new Date(quota.resetAt).toLocaleString()}` : 'The 48-hour window starts with your first download.'}</p>
            <p className="fine-print">Checking links is free. A credit is used when a file transfer starts.</p>
            <a href="/history" className="inline-link">Download history <ArrowRight size={18} /></a>
          </div>
        </section>
        <AppPromo />
      </>
    );
  }

  if (page === 'history') {
    return (
      <>
        <Intro title="Download history" copy="View your recent web downloads and transfer status." />
        <section className="history-panel wrap">
          {!profile ? (
            <div className="empty-state"><History size={44} /><h2>Sign in to view your history</h2><p>Your download records are linked to your Google account.</p>{googleButton}</div>
          ) : records.length === 0 ? (
            <div className="empty-state"><FolderDown size={44} /><h2>No downloads yet</h2><p>Start a download and its transfer record will appear here.</p><a className="button primary" href="/download">Download media <ArrowRight size={20} /></a></div>
          ) : (
            <>
              <div className="section-heading"><h2>Recent downloads</h2><button className="button outline small" onClick={loadHistory}><RotateCcw size={18} />Refresh</button></div>
              {records.map((record, index) => (
                <article className="history-row" key={record.id || index}>
                  <span className="step-icon"><FolderDown size={24} /></span>
                  <div><h3>{record.title || 'Media download'}</h3><p>{record.formatLabel || record.formatId || record.format_id || record.format} · {recordDate(record)}</p></div>
                  <span className="history-status" data-status={record.status}>{recordStatus(record.status)}</span>
                </article>
              ))}
            </>
          )}
        </section>
      </>
    );
  }

  if (page === 'help') {
    return (
      <>
        <Intro title="How can we help?" copy="Find answers about downloads, formats and your account." />
        <FaqSection full />
        <section className="contact-card wrap">
          <Mail size={32} /><div><h2>Contact support</h2><p>Get help from Amila, the creator of Clip Sevan.</p></div>
          <a href="mailto:vurixofficial@gmail.com" className="button outline">Email support <ArrowUpRight size={20} /></a>
        </section>
      </>
    );
  }

  if (page === 'updates') {
    return (
      <>
        <Intro title="Latest updates" copy="App releases and website updates from Clip Sevan." />
        <section className="updates-panel wrap">
          <article className="release-card">
            <div className="release-date">Android app<span>2.0.0 Beta</span></div>
            <div><h2>Clip Sevan 2.0.0 Beta</h2><p>Browse sites, download available video and audio formats, and play your saved media.</p><div className="release-tags"><span>Built-in browser</span><span>Background audio</span><span>Media tools</span></div><a href="/app" className="inline-link">View app details <ArrowRight size={18} /></a></div>
          </article>
          <article className="release-card">
            <div className="release-date">Clip7 website<span>Current version</span></div>
            <div><h2>Updated website experience</h2><p>A clearer mobile layout, larger controls, a direct download flow and refreshed account pages.</p></div>
          </article>
        </section>
        <ReleaseDetails />
      </>
    );
  }

  return (
    <>
      <Intro title="Privacy & terms" copy="How Clip7 handles your account and the media you choose to download." />
      <section className="legal-layout wrap">
        <aside aria-label="Legal topics"><a href="#privacy">Privacy</a><a href="#terms">Terms of use</a><a href="#copyright">Copyright</a></aside>
        <div className="legal-copy">
          <article id="privacy">
            <h2>Privacy</h2>
            <p>Google sign-in supplies your account identity, name, email and profile image. Your verified Firebase account ID connects your allowance and transfer records to your account. Clip7 does not receive your Google password.</p>
            <p>Media links are sent to the Clip Sevan media service to analyze and transfer the requested file. Account records contain the source hostname, format, status and timestamps. Raw media URLs and tokens are not saved in those records.</p>
            <p>Your browser’s standard user agent determines the initial mobile or desktop allowance. No device fingerprinting is used.</p>
            <p>Optional Google Analytics runs only when you choose “Allow analytics.” Your preference is saved in this browser. Google authentication may save session data to keep you signed in.</p>
            <button className="button outline" onClick={manageConsent}>Manage analytics preference</button>
            <p>History is retained with your account until you request removal. For a copy or deletion of account records, email <a href="mailto:vurixofficial@gmail.com">vurixofficial@gmail.com</a>. Do not send passwords or private media links.</p>
          </article>
          <article id="terms">
            <h2>Terms of use</h2>
            <p>Only download media you own, that is licensed for download, or that you have permission to save. You are responsible for using saved files in accordance with the source’s conditions.</p>
            <p>The web allowance is 25 downloads on mobile or 35 on desktop per 48-hour window. The device tier stays fixed for that window. A successful transfer start uses one credit. Checking links is free. Browser file-save completion cannot be observed.</p>
            <p>Media availability, speed, formats and file sizes depend on the original source and your connection. Some links cannot be processed. Clip Sevan is a beta release, and its features may change.</p>
          </article>
          <article id="copyright">
            <h2>Copyright & permissions</h2>
            <p>Clip7 does not grant rights to third-party content or support bypassing DRM, paywalls or private-content access controls. Source names identify their respective services and do not imply endorsement.</p>
            <p>For a copyright concern, email <a href="mailto:vurixofficial@gmail.com">vurixofficial@gmail.com</a> with the relevant link, your rights information and a description of the concern.</p>
          </article>
        </div>
      </section>
    </>
  );
}


