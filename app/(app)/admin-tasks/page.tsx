'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Task = {
  id: string
  title: string
  description: string | null
  created_at: string
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTasks()
  }, [])

  async function loadTasks() {
    setLoading(true)

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTasks(data)
    }

    setLoading(false)
  }

  if (loading) {
    return <div style={styles.loading}>Kraunami darbai...</div>
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <h1 style={styles.title}>Admin užduotys</h1>
        <p style={styles.subtitle}>
          Čia gali matyti ir valdyti visas sistemos užduotis.
        </p>
      </section>

      {tasks.length === 0 ? (
        <div style={styles.empty}>Užduočių nėra</div>
      ) : (
        <div style={styles.grid}>
          {tasks.map((task) => (
            <div key={task.id} style={styles.card}>
              <div style={styles.cardTitle}>{task.title}</div>
              <div style={styles.cardDesc}>
                {task.description || 'Be aprašymo'}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'grid',
    gap: 20,
    padding: 10,
  },
  hero: {
    background: '#eef4ef',
    padding: 20,
    borderRadius: 20,
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 900,
  },
  subtitle: {
    marginTop: 8,
    color: '#666',
  },
  loading: {
    padding: 40,
    textAlign: 'center',
  },
  empty: {
    padding: 30,
    background: '#fff',
    borderRadius: 20,
    border: '1px dashed #ccc',
  },
  grid: {
    display: 'grid',
    gap: 12,
  },
  card: {
    background: '#fff',
    padding: 16,
    borderRadius: 16,
    border: '1px solid #ddd',
  },
  cardTitle: {
    fontWeight: 800,
    fontSize: 18,
  },
  cardDesc: {
    marginTop: 8,
    color: '#666',
  },
}