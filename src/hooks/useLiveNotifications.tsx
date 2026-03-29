import { useEffect, useRef, useState } from 'react';

const useLiveNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const retryCount = useRef(0);
    const retryDelay = useRef(1000);
    const tokenRefreshTimer = useRef(null);

    const connect = () => {
        // Logic for establishing connection to the notifications stream
        console.log('Connecting to live notifications...');
        setIsConnected(true);
        resetRetryCounters();
    };

    const disconnect = () => {
        // Logic for disconnecting from the notifications stream
        console.log('Disconnecting from live notifications...');
        setIsConnected(false);
    };

    const resetRetryCounters = () => {
        retryCount.current = 0;
        retryDelay.current = 1000;
    };

    const handleReconnect = () => {
        if (retryCount.current < 5) {
            console.log(`Attempting to reconnect... attempt ${retryCount.current + 1}`);
            retryCount.current += 1;
            retryDelay.current = Math.min(retryDelay.current * 2, 30000);
            setTimeout(connect, retryDelay.current);
        } else {
            console.log('Max retry attempts reached.');
        }
    };

    const refreshToken = () => {
        // Logic for refreshing the token
        console.log('Refreshing token...');
    };

    useEffect(() => {
        connect();
        tokenRefreshTimer.current = setInterval(refreshToken, 600000); // Refresh every 10 minutes

        // Cleanup function
        return () => {
            disconnect();
            clearInterval(tokenRefreshTimer.current);
        };
    }, []);

    useEffect(() => {
        if (!isConnected) {
            handleReconnect();
        }
    }, [isConnected]);

    return { notifications, isConnected };
};

export default useLiveNotifications;