package main
import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	APIKey             string
	ModelName          string
	BaseURL            string
	Port               string
	CORSAllowedOrigins []string
}

func LoadConfig() *Config {
	_ = godotenv.Load()

	apiKey := os.Getenv("API_KEY")
	if apiKey == "" {
		log.Fatal("environment variable API_KEY is required")
	}

	modelName := os.Getenv("MODEL_NAME")
	if modelName == "" {
		log.Fatal("environment variable MODEL_NAME is required")
	}

	baseURL := os.Getenv("BASE_URL")
	if baseURL != "" {
		baseURL = strings.TrimRight(baseURL, "/")
		if !strings.HasSuffix(baseURL, "/v1") {
			baseURL += "/v1"
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	var origins []string
	if corsStr := os.Getenv("CORS_ALLOWED_ORIGINS"); corsStr != "" {
		for _, o := range strings.Split(corsStr, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				origins = append(origins, o)
			}
		}
	}

	return &Config{
		APIKey:             apiKey,
		ModelName:          modelName,
		BaseURL:            baseURL,
		Port:               port,
		CORSAllowedOrigins: origins,
	}
}