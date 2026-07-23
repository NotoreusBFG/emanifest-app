'use client' // 1. This tells Next.js this file has interactive buttons and state

import { useActionState } from 'react';
import { saveEpaSettingsAction } from '@/app/actions/epaActions';

export default function EpaSettingsPage() {
  // 2. 'useActionState' connects our form to the Server Action.
  // [state] = the result (success/error)
  // [formAction] = the function we link to the form
  // [isPending] = true if the form is currently saving
  const [state, formAction, isPending] = useActionState(saveEpaSettingsAction, null);

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>EPA Settings</h1>
      <p style={{ color: '#666' }}>Securely store your API credentials.</p>

      {/* 3. The 'action' prop tells the form to run our Server Action when submitted */}
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <div>
          <label htmlFor="apiId" style={{ display: 'block', marginBottom: '5px' }}>EPA Site ID (API ID)</label>
          <input
            id="apiId"
            name="apiId" // This name MUST match what we look for in 'epaActions.ts'
            type="text"
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="apiKey" style={{ display: 'block', marginBottom: '5px' }}>EPA Secret Key</label>
          <input
            id="apiKey"
            name="apiKey" // This name MUST match what we look for in 'epaActions.ts'
            type="password"
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        {/* 4. We use 'isPending' to disable the button so the user doesn't click twice */}
        <button 
          type="submit" 
          disabled={isPending}
          style={{ 
            padding: '10px', 
            backgroundColor: isPending ? '#ccc' : '#0070f3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: isPending ? 'not-allowed' : 'pointer' 
          }}
        >
          {isPending ? 'Saving Securely...' : 'Save Credentials'}
        </button>

        {/* 5. Show a message to the user based on the 'state' returned by the Server Action */}
        {state?.success && (
          <p style={{ color: 'green', marginTop: '10px' }}>✅ {state.message}</p>
        )}
        {state?.error && (
          <p style={{ color: 'red', marginTop: '10px' }}>❌ {state.error}</p>
        )}
      </form>
    </div>
  );
}