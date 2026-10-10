package main

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

type ChatHandler struct {
	chatService *ChatService
}

func NewChatHandler(chatService *ChatService) *ChatHandler {
	return &ChatHandler{
		chatService: chatService,
	}
}

func (h *ChatHandler) StreamChatHandler(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid request payload: %v", err)})
		return
	}

	ctx := c.Request.Context()
	stream, err := h.chatService.CreateChatStream(ctx, req.Messages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create chat stream: %v", err)})
		return
	}
	defer stream.Close()

	c.Stream(func(w io.Writer) bool {
		select {
		case <-ctx.Done():
			return false
		default:
			msg, err := stream.Recv()
			if errors.Is(err, io.EOF) {
				c.SSEvent("message", gin.H{"content": "[DONE]"})
				return false
			}
			if err != nil {
				c.SSEvent("error", gin.H{"error": err.Error()})
				return false
			}

			if msg != nil && msg.Content != "" {
				c.SSEvent("message", gin.H{"content": msg.Content})
				return true
			}
			
			return true
		}
	})
}