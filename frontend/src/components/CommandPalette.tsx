import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, LayoutDashboard, Briefcase, Bell, Settings, Moon, Sun, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal?: () => void;
}

export default function CommandPalette({ isOpen, onClose, onOpenAddModal }: Props) {
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Re-open palette
          window.dispatchEvent(new CustomEvent('open-command-palette'));
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('dark-mode');
    }
    onClose();
  };

  const actions = [
    {
      id: 'add',
      label: 'Add application',
      icon: Plus,
      category: 'Actions',
      run: () => {
        onClose();
        if (onOpenAddModal) onOpenAddModal();
      },
    },
    {
      id: 'dash',
      label: 'Go to Overview',
      icon: LayoutDashboard,
      category: 'Navigation',
      run: () => {
        navigate('/');
        onClose();
      },
    },
    {
      id: 'apps',
      label: 'View Applications',
      icon: Briefcase,
      category: 'Navigation',
      run: () => {
        navigate('/applications');
        onClose();
      },
    },
    {
      id: 'notifs',
      label: 'View Notifications',
      icon: Bell,
      category: 'Navigation',
      run: () => {
        navigate('/notifications');
        onClose();
      },
    },
    {
      id: 'settings',
      label: 'Open Settings',
      icon: Settings,
      category: 'Navigation',
      run: () => {
        navigate('/settings');
        onClose();
      },
    },
    {
      id: 'theme',
      label: `Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`,
      icon: theme === 'light' ? Moon : Sun,
      category: 'Appearance',
      run: toggleTheme,
    },
  ];

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrapper">
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            autoFocus
            type="text"
            className="cmd-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div className="cmd-results">
          {filtered.length === 0 ? (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              No commands found.
            </div>
          ) : (
            filtered.map((item) => {
              const IconComponent = item.icon;
              return (
                <div key={item.id} className="cmd-item" onClick={item.run}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <IconComponent size={18} style={{ color: 'var(--text-secondary)' }} />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
