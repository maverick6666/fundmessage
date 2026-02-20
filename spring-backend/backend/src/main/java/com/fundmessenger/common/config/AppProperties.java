package com.fundmessenger.common.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Cors cors = new Cors();
    private Kis kis = new Kis();
    private OpenAi openai = new OpenAi();
    private AiConfig newsdesk = new AiConfig();
    private AiConfig decision = new AiConfig();
    private AiConfig report = new AiConfig();
    private Vapid vapid = new Vapid();
    private Upload upload = new Upload();
    private Smtp smtp = new Smtp();
    private Cerebras cerebras = new Cerebras();
    private MarketAux marketaux = new MarketAux();
    private Naver naver = new Naver();
    private String environment = "development";

    @Getter @Setter
    public static class Cerebras {
        private String apiKey;
        private String model = "gpt-oss-120b";
        private String baseUrl = "https://api.cerebras.ai/v1";
        private int maxCompletionTokens = 8192;
    }

    @Getter @Setter
    public static class MarketAux {
        private String apiKey;
    }

    @Getter @Setter
    public static class Naver {
        private String clientId;
        private String clientSecret;
    }

    @Getter @Setter
    public static class Jwt {
        private String secret;
        private String algorithm = "HS256";
        private int accessTokenExpireMinutes = 60;
        private int refreshTokenExpireDays = 30;
    }

    @Getter @Setter
    public static class Cors {
        private List<String> allowedOrigins = List.of(
            "http://localhost",
            "http://localhost:5173",
            "http://localhost:3000",
            "https://fundmessage.vercel.app"
        );
    }

    @Getter @Setter
    public static class Kis {
        private String appKey;
        private String appSecret;
    }

    @Getter @Setter
    public static class OpenAi {
        private String apiKey;
        private String model = "gpt-5-mini";
        private double temperature = 0.7;
    }

    @Getter @Setter
    public static class AiConfig {
        private String verbosity = "high";
        private int maxTokens = 32768;
        private String reasoningEffort = "medium";
    }

    @Getter @Setter
    public static class Vapid {
        private String publicKey;
        private String privateKey;
        private String claimsEmail = "mailto:fund@messenger.app";
    }

    @Getter @Setter
    public static class Upload {
        private String dir = "/tmp/fundmessage_uploads";
    }

    @Getter @Setter
    public static class Smtp {
        private String fromEmail;
    }
}
