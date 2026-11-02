'use client'
import { createAuthClient } from 'better-auth/react'

// Same-origin requests; no secrets live in the browser.
export const authClient = createAuthClient()
