package com.manishmeena.mkai.data.remote

import com.manishmeena.mkai.data.model.*
import retrofit2.http.*

interface MkAiApiService {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponse

    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterRequest): AuthResponse

    @GET("api/auth/me")
    suspend fun getProfile(): Map<String, UserProfile>

    @PATCH("api/auth/profile")
    suspend fun updateProfile(@Body body: ProfileUpdateRequest): Map<String, UserProfile>

    @GET("api/conversations")
    suspend fun getConversations(): ConversationsResponse

    @GET("api/conversations/{id}/messages")
    suspend fun getMessages(@Path("id") conversationId: String): MessagesResponse

    @POST("api/chat")
    suspend fun sendChat(@Body body: ChatRequest): ChatResponse

    @GET("api/providers")
    suspend fun getProviders(): ProvidersResponse
}
