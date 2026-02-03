// Settings Hook - Manage app settings from Firestore
// Provides club name, admin list, logo URL, and update functions

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, MASTER_ADMIN_EMAIL, ADMIN_EMAILS, DEFAULT_CLUB_NAME } from '../firebase/firebase';

const DEFAULT_LOGO_URL = '/logo.png';

// Hook to get and update app settings
export const useSettings = () => {
    const [settings, setSettings] = useState({
        clubName: DEFAULT_CLUB_NAME,
        logoUrl: DEFAULT_LOGO_URL,
        adminEmails: ADMIN_EMAILS,
        loading: true
    });

    useEffect(() => {
        const settingsRef = doc(db, 'settings', 'app');

        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSettings({
                    clubName: data.clubName || DEFAULT_CLUB_NAME,
                    logoUrl: data.logoUrl || DEFAULT_LOGO_URL,
                    adminEmails: data.adminEmails || ADMIN_EMAILS,
                    loading: false
                });
            } else {
                setSettings({
                    clubName: DEFAULT_CLUB_NAME,
                    logoUrl: DEFAULT_LOGO_URL,
                    adminEmails: ADMIN_EMAILS,
                    loading: false
                });
            }
        }, (error) => {
            console.error('Error fetching settings:', error);
            setSettings({
                clubName: DEFAULT_CLUB_NAME,
                logoUrl: DEFAULT_LOGO_URL,
                adminEmails: ADMIN_EMAILS,
                loading: false
            });
        });

        return () => unsubscribe();
    }, []);

    const updateClubName = async (newName) => {
        const settingsRef = doc(db, 'settings', 'app');
        await setDoc(settingsRef, { clubName: newName }, { merge: true });
    };

    const updateLogoUrl = async (newUrl) => {
        const settingsRef = doc(db, 'settings', 'app');
        await setDoc(settingsRef, { logoUrl: newUrl || DEFAULT_LOGO_URL }, { merge: true });
    };

    const addAdmin = async (email) => {
        try {
            const settingsRef = doc(db, 'settings', 'app');
            const docSnap = await getDoc(settingsRef);
            const currentAdmins = docSnap.exists() ? (docSnap.data().adminEmails || []) : ADMIN_EMAILS;

            const normalizedEmail = email.toLowerCase().trim();
            if (currentAdmins.some(e => e.toLowerCase() === normalizedEmail)) {
                throw new Error('This email is already an admin');
            }
            
            await setDoc(settingsRef, {
                adminEmails: [...currentAdmins, normalizedEmail]
            }, { merge: true });
            
            console.log('Admin added successfully:', normalizedEmail);
        } catch (error) {
            console.error('Error adding admin:', error);
            throw error;
        }
    };

    const removeAdmin = async (email) => {
        const settingsRef = doc(db, 'settings', 'app');
        const docSnap = await getDoc(settingsRef);
        const currentAdmins = docSnap.exists() ? (docSnap.data().adminEmails || []) : ADMIN_EMAILS;

        const normalizedEmail = email.toLowerCase().trim();
        // Can't remove master admin
        if (normalizedEmail === MASTER_ADMIN_EMAIL.toLowerCase()) {
            throw new Error('Cannot remove master admin');
        }

        await setDoc(settingsRef, {
            adminEmails: currentAdmins.filter(e => e.toLowerCase() !== normalizedEmail)
        }, { merge: true });
    };

    const isAdmin = (email) => {
        if (!email) return false;
        const normalizedEmail = email.toLowerCase();
        return settings.adminEmails.some(e => e.toLowerCase() === normalizedEmail) ||
            normalizedEmail === MASTER_ADMIN_EMAIL.toLowerCase();
    };

    const isMasterAdmin = (email) => {
        if (!email) return false;
        return email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
    };

    return {
        clubName: settings.clubName,
        logoUrl: settings.logoUrl,
        adminEmails: settings.adminEmails,
        loading: settings.loading,
        updateClubName,
        updateLogoUrl,
        addAdmin,
        removeAdmin,
        isAdmin,
        isMasterAdmin
    };
};

export default useSettings;
