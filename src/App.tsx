import { useState, useEffect } from 'react';
import { Music, Heart, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const API_BASE = 'https://rucha.zo.space';

const theme = {
  background: 'linear-gradient(135deg, #FFF5F7 0%, #F0E6FF 50%, #E0F4FF 100%)',
  cardBg: 'rgba(255, 255, 255, 0.6)',
  pastelBlush: '#FFD4E5',
  pastelLavender: '#E6D7F0',
  pastelMint: '#D4F0E8',
  pastelPeach: '#FFD9B8',
  pastelBlue: '#D4E5F0',
  accentPink: '#FF69B4',
  accentPurple: '#9D6FD9',
  textDark: '#5A4A6B',
};

interface FormData {
  date: string;
  minutes: string;
  whatPracticed: string;
  sankalp: string;
  raag: string;
  omkarTime: string;
  alankarTime: string;
}

interface Session {
  date: string;
  minutes: string;
  whatPracticed: string;
  sankalp: string;
  raag: string;
  omkarTime: string;
  alankarTime: string;
}

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

export default function App() {
  const [formData, setFormData] = useState<FormData>({
    date: new Date().toISOString().split('T')[0],
    minutes: '',
    whatPracticed: '',
    sankalp: '',
    raag: '',
    omkarTime: '',
    alankarTime: '',
  });

  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ sheets: StatusMessage | null; forms: StatusMessage | null }>({
    sheets: null,
    forms: null,
  });
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    fetchRecentSessions();
  }, []);

  const fetchRecentSessions = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/recent-sessions`);
      if (response.ok) {
        const data = await response.json();
        setRecentSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load recent sessions:', err);
    } finally {
      setLoadingRecent(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessages({ sheets: null, forms: null });

    try {
      const response = await fetch(`${API_BASE}/api/submit-practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to submit');

      const result = await response.json();

      setMessages({
        sheets: result.sheetsSubmitted !== false
          ? { type: 'success', message: '✅ Successfully logged to Google Sheets' }
          : { type: 'error', message: '❌ Failed to log to Google Sheets' },
        forms: result.formsSubmitted !== false
          ? { type: 'success', message: '✅ Successfully submitted to Google Form' }
          : { type: 'error', message: result.formsError ? `❌ Form error: ${result.formsError}` : '❌ Failed to submit to Google Form' },
      });

      setFormData({
        date: new Date().toISOString().split('T')[0],
        minutes: '',
        whatPracticed: '',
        sankalp: '',
        raag: '',
        omkarTime: '',
        alankarTime: '',
      });

      fetchRecentSessions();
    } catch (err) {
      console.error('Submission error:', err);
      setMessages({
        sheets: { type: 'error', message: '❌ Submission failed' },
        forms: { type: 'error', message: '❌ Submission failed' },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: theme.background }} className="min-h-screen p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Music className="w-8 h-8" style={{ color: theme.accentPink }} />
            <h1 className="text-4xl font-bold" style={{ color: theme.textDark }}>
              Sankalp
            </h1>
            <Music className="w-8 h-8" style={{ color: theme.accentPurple }} />
          </div>
          <p style={{ color: theme.textDark }} className="text-sm opacity-80">
            Track your practice journey 🎵
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-2">
            {/* Status Messages */}
            <div className="mb-6 space-y-3">
              {messages.sheets && (
                <div
                  className="p-4 rounded-lg flex items-center gap-2 animate-fade-in"
                  style={{ background: messages.sheets.type === 'success' ? theme.pastelMint : '#FFD4D4' }}
                >
                  {messages.sheets.type === 'success'
                    ? <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />
                    : <AlertCircle className="w-5 h-5" style={{ color: '#EF4444' }} />
                  }
                  <p style={{ color: theme.textDark }} className="font-semibold">
                    {messages.sheets.message}
                  </p>
                </div>
              )}
              {messages.forms && (
                <div
                  className="p-4 rounded-lg flex items-center gap-2 animate-fade-in"
                  style={{ background: messages.forms.type === 'success' ? theme.pastelBlue : '#FFD4D4' }}
                >
                  {messages.forms.type === 'success'
                    ? <CheckCircle className="w-5 h-5" style={{ color: '#3B82F6' }} />
                    : <AlertCircle className="w-5 h-5" style={{ color: '#EF4444' }} />
                  }
                  <p style={{ color: theme.textDark }} className="font-semibold">
                    {messages.forms.message}
                  </p>
                </div>
              )}
            </div>

            {/* Form Card */}
            <form
              onSubmit={handleSubmit}
              className="backdrop-blur-sm rounded-2xl p-8 shadow-lg"
              style={{ background: theme.cardBg }}
            >
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.textDark }}>
                  📅 Date of Practice
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-transparent focus:outline-none transition-all"
                  style={{ background: theme.pastelBlush, color: theme.textDark }}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.textDark }}>
                  ⏱️ Minutes Practiced
                </label>
                <input
                  type="number"
                  name="minutes"
                  value={formData.minutes}
                  onChange={handleChange}
                  placeholder="e.g., 45"
                  required
                  min="0"
                  className="w-full px-4 py-3 rounded-lg border-2 border-transparent focus:outline-none transition-all"
                  style={{ background: theme.pastelBlue, color: theme.textDark }}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.textDark }}>
                  🎼 What did you practice?
                </label>
                <textarea
                  name="whatPracticed"
                  value={formData.whatPracticed}
                  onChange={handleChange}
                  placeholder="e.g., Raga Yaman, Alankars..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg border-2 border-transparent focus:outline-none transition-all resize-none"
                  style={{ background: theme.pastelPeach, color: theme.textDark }}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.textDark }}>
                  ✨ Sankalp Word (optional)
                </label>
                <input
                  type="text"
                  name="sankalp"
                  value={formData.sankalp}
                  onChange={handleChange}
                  placeholder="A word that comes to mind..."
                  className="w-full px-4 py-3 rounded-lg border-2 border-transparent focus:outline-none transition-all"
                  style={{ background: theme.pastelLavender, color: theme.textDark }}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.textDark }}>
                  🎵 Raag (optional)
                </label>
                <input
                  type="text"
                  name="raag"
                  value={formData.raag}
                  onChange={handleChange}
                  placeholder="Main raag you practiced"
                  className="w-full px-4 py-3 rounded-lg border-2 border-transparent focus:outline-none transition-all"
                  style={{ background: theme.pastelMint, color: theme.textDark }}
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.textDark }}>
                  🕉️ Omkar Time (mins) (optional)
                </label>
                <input
                  type="number"
                  name="omkarTime"
                  value={formData.omkarTime}
                  onChange={handleChange}
                  placeholder="e.g., 10"
                  min="0"
                  className="w-full px-4 py-3 rounded-lg border-2 border-transparent focus:outline-none transition-all"
                  style={{ background: theme.pastelBlush, color: theme.textDark }}
                />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-semibold mb-2" style={{ color: theme.textDark }}>
                  🎶 Alankars Time (mins) (optional)
                </label>
                <input
                  type="number"
                  name="alankarTime"
                  value={formData.alankarTime}
                  onChange={handleChange}
                  placeholder="e.g., 20"
                  min="0"
                  className="w-full px-4 py-3 rounded-lg border-2 border-transparent focus:outline-none transition-all"
                  style={{ background: theme.pastelBlue, color: theme.textDark }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-bold text-white transition-all hover:shadow-lg active:scale-95"
                style={{
                  background: loading ? '#CCC' : `linear-gradient(135deg, ${theme.accentPink}, ${theme.accentPurple})`,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" /> Submitting...
                  </span>
                ) : '🎯 Log Practice'}
              </button>
            </form>

            <p className="text-center mt-6 text-sm" style={{ color: theme.textDark }}>
              Keep practicing! Every session counts. 🌟
            </p>
          </div>

          {/* Recent Sessions Sidebar */}
          <div className="lg:col-span-1">
            <div className="backdrop-blur-sm rounded-2xl p-6 shadow-lg" style={{ background: theme.cardBg }}>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: theme.textDark }}>
                <Heart className="w-6 h-6" style={{ color: theme.accentPink }} />
                Recent Sessions
              </h2>

              {loadingRecent ? (
                <div className="flex justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin" style={{ color: theme.accentPurple }} />
                </div>
              ) : recentSessions.length === 0 ? (
                <p style={{ color: theme.textDark }} className="opacity-70 text-sm">
                  No sessions logged yet. Start your practice! 🎵
                </p>
              ) : (
                <div className="space-y-3">
                  {recentSessions.map((session, idx) => (
                    <div key={idx} className="p-3 rounded-lg" style={{ background: theme.pastelLavender }}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold" style={{ color: theme.textDark }}>
                          {session.date}
                        </span>
                        <span className="text-sm font-bold" style={{ color: theme.accentPink }}>
                          {session.minutes} min
                        </span>
                      </div>
                      {session.raag && (
                        <p className="text-xs opacity-75" style={{ color: theme.textDark }}>
                          {session.raag}
                        </p>
                      )}
                      {session.sankalp && (
                        <p className="text-xs italic mt-1" style={{ color: theme.accentPurple }}>
                          "{session.sankalp}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}
