package main

type MessagePayload struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Image   string `json:"image,omitempty"`
}

type ChatRequest struct {
	Messages []MessagePayload `json:"messages" binding:"required"`
}