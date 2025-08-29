package main

import (
	"log"
	"net/http"
)

// PKCEGrantParams matches the flat JSON structure sent by the frontend
// Frontend sends: { "auth_code": "AUTH_CODE_FROM_GOOGLE", "verifier": "PKCE_VERIFIER_STRING" }
type PKCEGrantParams struct {
	AuthCode string `json:"auth_code"`
	Verifier string `json:"verifier"`
}

func main() {
	http.HandleFunc("/api/auth/google/callback", handleOAuthCallback)
	
	port := ":8080"
	log.Printf("[AUTH LOG] Starting Go OAuth backend on port %s", port)
	log.Printf("[AUTH LOG] Ready to receive flat JSON structure: { \"code\": \"...\", \"verifier\": \"...\" }")
	
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal(err)
	}
}