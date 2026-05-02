import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { Shield, Eye, EyeOff, Lock } from 'lucide-react'

export default function Login() {
    const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSetup, setIsSetup] = useState(true)
  const [statusLoading, setStatusLoading] = useState(true)
  const navigate = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (isAuthenticated) { navigate('/dashboard'); return }
    authApi.getStatus()
      .then(s => setIsSetup(s.is_setup))
      .catch(() => setIsSetup(false))
      .finally(() => setStatusLoading(false))
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    setError('')
    setLoading(true)
    try {
      const data = isSetup
        ? await authApi.login(password)
        : await authApi.setup(password)
      setToken(data.token)
      navigate('/dashboard')
    } catch {
      setError(isSetup ? `Mot de passe incorrect` : `Erreur lors du setup`)
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(#00d4ff 1px, transparent 1px), linear-gradient(90deg, #00d4ff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 mb-4">
            <Shield size={32} className="text-cyber-cyan" />
          </div>
          <h1 className="text-3xl font-bold text-cyber-cyan tracking-widest">CYBER-HUB</h1>
          <p className="text-text-muted text-sm mt-2">{`Hub de cybersécurité local · offline`}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-xl p-8">
          {!statusLoading && !isSetup && (
            <div className="mb-6 p-3 rounded bg-cyber-orange/10 border border-cyber-orange/30">
              <p className="text-cyber-orange text-sm text-center">
                {`Premier lancement — Définissez votre mot de passe`}
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-text-secondary text-sm mb-2">
                <Lock size={14} className="inline mr-1" />
                {isSetup ? `Mot de passe` : `Nouveau mot de passe`}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSetup ? '••••••••' : `Min. 4 caractères`}
                  className="input pr-10"
                  autoFocus
                  disabled={loading || statusLoading}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-cyber-red text-sm text-center">{error}</p>}
            <button type="submit" disabled={loading || !password.trim() || statusLoading}
              className="btn-primary w-full py-2.5">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-bg-primary border-t-transparent rounded-full" />
                  {`Connexion...`}
                </span>
              ) : isSetup ? `Connexion` : `Configurer`}
            </button>
          </form>
        </div>
        <p className="text-center text-text-muted text-xs mt-6">
          {`Usage légal uniquement · Données 100% locales`}
        </p>
      </div>
    </div>
  )
}
