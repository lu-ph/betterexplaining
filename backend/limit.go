package main

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type IPLimiter struct {
	ips muSync
}

type muSync struct {
	sync.RWMutex
	limiters map[string]*rate.Limiter
}

var limiterMap = muSync{limiters: make(map[string]*rate.Limiter)}

func getLimiter(ip string) *rate.Limiter {
	limiterMap.Lock()
	defer limiterMap.Unlock()

	v, exists := limiterMap.limiters[ip]
	if !exists {
		limiter := rate.NewLimiter(rate.Every(time.Second/5), 10)
		limiterMap.limiters[ip] = limiter
		return limiter
	}
	return v
}

func LimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := getLimiter(ip)

		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Too many requests. Please try again later.",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}