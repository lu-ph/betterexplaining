package main

import (
	"context"
	"log"
	"strings"

	"github.com/gin-gonic/gin"
)

func main() {
	ctx := context.Background()
	cfg := LoadConfig()

	chatService, err := NewChatService(ctx, cfg)
	if err != nil {
		panic("failed initializing chat service")
	}
	chatHandler := NewChatHandler(chatService)

	r := gin.Default()
	r.Use(
		corsMiddleware(cfg.CORSAllowedOrigins),
		LimitMiddleware(),
	)

	apiGroup := r.Group("/api")
	{
		apiGroup.POST("/chat", chatHandler.StreamChatHandler)
	}

	log.Printf("Server listening on port :%s with model: %s\n", cfg.Port, cfg.ModelName)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if origin != "" {
			for _, allowed := range allowedOrigins {
				if allowed == "*" || strings.Contains(origin, allowed) {
					c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
					break
				}
			}
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
