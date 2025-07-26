export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { venueId } = req.body;
    
    if (!venueId) {
      return res.status(400).json({ error: 'venueId is required' });
    }

    console.log(`[REFETCH_MENU] Triggering refetch for venue: ${venueId}`);

    // This endpoint can be called to trigger a menu refetch
    // The actual refetch logic is handled in the frontend
    return res.json({ 
      success: true, 
      message: `Refetch triggered for venue: ${venueId}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[REFETCH_MENU] Error:', error);
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 