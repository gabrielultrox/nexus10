import { useEffect, useRef } from 'react'
import { firebaseAuth as auth } from '../services/firebase'

const useLiveNotifications = () => {
  const eventSourceRef = useRef(null)
  const retryCountRef = useRef(0)
  const timerRef = useRef(null)

  const MAX_RETRY_ATTEMPTS = 5
  const MAX_RETRY_DELAY = 30000 // 30 seconds

  const fetchNotifications = (token) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    eventSourceRef.current = new EventSource(`https://your-api-url/notifications?token=${token}`)

    eventSourceRef.current.onmessage = (event) => {
      // Handle the notification
      console.log('New notification:', event.data)
    }

    eventSourceRef.current.onerror = () => {
      if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        retryCountRef.current++
        const retryDelay = Math.min(retryCountRef.current * 5000, MAX_RETRY_DELAY)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          auth.currentUser.getIdToken(/* force refresh */ true).then((token) => {
            fetchNotifications(token)
          })
        }, retryDelay)
      } else {
        console.error('Max retry attempts reached. Closing EventSource.')
        eventSourceRef.current.close()
      }
    }
  }

  useEffect(() => {
    const init = async () => {
      const token = await auth.currentUser.getIdToken()
      fetchNotifications(token)
    }

    init()

    const intervalId = setInterval(
      () => {
        auth.currentUser.getIdToken(/* force refresh */ true)
      },
      10 * 60 * 1000,
    ) // Refresh token every 10 minutes

    return () => {
      clearInterval(intervalId)
      clearTimeout(timerRef.current)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return {
    eventSource: eventSourceRef.current,
  }
}

export { useLiveNotifications }
