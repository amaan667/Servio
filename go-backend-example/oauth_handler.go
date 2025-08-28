package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// OAuthConfig holds the OAuth configuration
type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

// GoogleTokenResponse represents the response from Google's token endpoint
type GoogleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	IDToken      string `json:"id_token,omitempty"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope,omitempty"`
	Error        string `json:"error,omitempty"`
	ErrorDesc    string `json:"error_description,omitempty"`
}

// getOAuthConfig loads OAuth configuration from environment variables
func getOAuthConfig() *OAuthConfig {
	return &OAuthConfig{
		ClientID:     os.Getenv("GOOGLE_OAUTH_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET"),
		RedirectURI:  os.Getenv("GOOGLE_OAUTH_REDIRECT_URI"),
	}
}

// exchangeCodeForToken performs the actual OAuth token exchange with Google
func exchangeCodeForToken(code, verifier string, config *OAuthConfig) (*GoogleTokenResponse, error) {
	log.Printf("[AUTH LOG] Starting token exchange with Google")

	// Prepare the token exchange request
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", config.RedirectURI)
	data.Set("client_id", config.ClientID)
	data.Set("code_verifier", verifier)
	if config.ClientSecret != "" {
		data.Set("client_secret", config.ClientSecret)
	}

	// Make the request to Google's token endpoint
	req, err := http.NewRequest("POST", "https://oauth2.googleapis.com/token", strings.NewReader(data.Encode()))
	if err != nil {
		log.Printf("[AUTH LOG] Failed to create token request: %v", err)
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[AUTH LOG] Failed to make token request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	var tokenResp GoogleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		log.Printf("[AUTH LOG] Failed to decode token response: %v", err)
		return nil, err
	}

	if tokenResp.Error != "" {
		log.Printf("[AUTH LOG] Google OAuth error: %s - %s", tokenResp.Error, tokenResp.ErrorDesc)
		return &tokenResp, fmt.Errorf("OAuth error: %s", tokenResp.Error)
	}

	log.Printf("[AUTH LOG] Token exchange successful, access_token present: %t", tokenResp.AccessToken != "")
	return &tokenResp, nil
}

// handleOAuthCallback processes the OAuth callback from the frontend
func handleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the flat JSON structure from frontend
	var params PKCEGrantParams
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		log.Printf("[AUTH LOG] JSON decode error: %v", err)
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Comprehensive logging as requested
	log.Printf("[AUTH LOG] received_code=%s, received_verifier=%s", params.AuthCode, params.Verifier)

	if params.AuthCode == "" {
		log.Printf("[AUTH LOG] missing_code")
		http.Error(w, "missing_code", http.StatusBadRequest)
		return
	}

	if params.Verifier == "" {
		log.Printf("[AUTH LOG] missing_verifier")
		http.Error(w, "missing_verifier", http.StatusBadRequest)
		return
	}

	log.Printf("[AUTH LOG] Processing OAuth exchange for code length=%d, verifier length=%d", 
		len(params.AuthCode), len(params.Verifier))

	// Get OAuth configuration
	config := getOAuthConfig()
	if config.ClientID == "" {
		log.Printf("[AUTH LOG] Missing GOOGLE_OAUTH_CLIENT_ID configuration")
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	// Exchange the authorization code for tokens
	tokenResp, err := exchangeCodeForToken(params.AuthCode, params.Verifier, config)
	if err != nil {
		log.Printf("[AUTH LOG] Token exchange failed: %v", err)
		http.Error(w, "Token exchange failed", http.StatusBadRequest)
		return
	}

	// Log successful exchange
	log.Printf("[AUTH LOG] OAuth exchange completed successfully")

	// Return the token response to the client
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokenResp)
}