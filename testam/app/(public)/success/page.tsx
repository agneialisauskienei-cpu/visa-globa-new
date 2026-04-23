import Link from 'next/link'
import { theme } from '@/lib/theme'

export default function SuccessPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          padding: 32,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
          backgroundColor: theme.colors.card,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            marginBottom: 18,
            fontSize: 36,
            fontWeight: 700,
            color: theme.colors.text,
          }}
        >
          Viskas pavyko
        </h1>

        <p
          style={{
            color: theme.colors.textSecondary,
            fontSize: 18,
            lineHeight: 1.7,
            marginBottom: 20,
          }}
        >
          El. paštas patvirtintas sėkmingai. Dabar gali prisijungti prie savo
          paskyros.
        </p>

        <Link
          href="/login"
          style={{
            display: 'inline-block',
            padding: '14px 22px',
            borderRadius: 14,
            backgroundColor: theme.colors.primary,
            color: '#ffffff',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Eiti į prisijungimą
        </Link>
      </div>
    </div>
  )
}