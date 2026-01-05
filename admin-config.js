// Admin Configuration for Jukebox App
// Location verification settings

export const ADMIN_CONFIG = {
    // Location settings for Queensland, Australia (actual venue coordinates)
    location: {
        // Venue coordinates (actual venue location)
        latitude: -25.2842214,     // Queensland, Australia - actual venue location
        longitude: 152.8552310,    // Queensland, Australia - actual venue location
        
        // Allowed distance in meters (50 meters = 0.05km)
        allowedDistance: 50,   // meters
        
        // Location name for display
        venueName: "8-Bit Bar",
        
        // Address for display
        address: "Queensland, Australia"
    },
    
    // App settings
    app: {
        name: "8-Bit Bar Jukebox",
        version: "1.0.0",
        debugMode: false
    },
    
    // API settings
    api: {
        baseUrl: "http://localhost:3001/api",
        timeout: 10000
    }
};

// Helper function to calculate distance between two coordinates
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

// Helper function to check if user is within allowed distance
export function isLocationAllowed(userLat, userLon) {
    const distance = calculateDistance(
        ADMIN_CONFIG.location.latitude,
        ADMIN_CONFIG.location.longitude,
        userLat,
        userLon
    );
    
    return {
        allowed: distance <= ADMIN_CONFIG.location.allowedDistance,
        distance: Math.round(distance),
        maxDistance: ADMIN_CONFIG.location.allowedDistance,
        venueName: ADMIN_CONFIG.location.venueName
    };
}

// Helper function to format distance for display
export function formatDistance(meters) {
    if (meters < 1000) {
        return `${meters}m`;
    } else {
        return `${(meters / 1000).toFixed(2)}km`;
    }
}
