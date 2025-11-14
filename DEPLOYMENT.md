# Azure Deployment Guide

This guide will help you deploy your Gemini Chatbot to Azure App Service.

## Prerequisites

- Azure account (free tier available)
- Azure CLI installed (optional but recommended)
- Your Gemini API key
- Firebase project configured

## Step 1: Create Azure App Service

### Using Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource"
3. Search for "Web App"
4. Click "Create"
5. Fill in the details:
   - **Subscription**: Your subscription
   - **Resource Group**: Create new or use existing
   - **Name**: Choose a unique name (e.g., `gemini-chatbot-2024`)
   - **Publish**: Code
   - **Runtime stack**: Node 18 LTS or Node 20 LTS
   - **Operating System**: Linux (recommended) or Windows
   - **Region**: Choose closest to your users
   - **App Service Plan**: Create new (Free tier available for testing)
6. Click "Review + create" then "Create"

### Using Azure CLI

```bash
# Login to Azure
az login

# Create resource group
az group create --name myResourceGroup --location eastus

# Create App Service plan (Free tier)
az appservice plan create --name myAppServicePlan --resource-group myResourceGroup --sku FREE --is-linux

# Create web app
az webapp create --resource-group myResourceGroup --plan myAppServicePlan --name gemini-chatbot-2024 --runtime "NODE:18-lts"
```

## Step 2: Configure Environment Variables

### Using Azure Portal

1. Go to your App Service in Azure Portal
2. Navigate to **Configuration** → **Application settings**
3. Click **+ New application setting**
4. Add the following:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key
5. Click **OK** then **Save**

### Using Azure CLI

```bash
az webapp config appsettings set \
  --resource-group myResourceGroup \
  --name gemini-chatbot-2024 \
  --settings GEMINI_API_KEY="your_gemini_api_key_here"
```

## Step 3: Deploy Your Code

### Option A: Deploy using VS Code (Easiest)

1. Install the [Azure App Service extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azureappservice) in VS Code
2. Open your project in VS Code
3. Click the Azure icon in the sidebar
4. Sign in to Azure
5. Right-click on your App Service → "Deploy to Web App"
6. Select your project folder
7. Wait for deployment to complete

### Option B: Deploy using Git

1. In Azure Portal, go to your App Service → **Deployment Center**
2. Choose **GitHub** or **Local Git**
3. Follow the setup wizard
4. Push your code to the repository
5. Azure will automatically deploy

### Option C: Deploy using Azure CLI

```bash
# Install Azure CLI extension for web apps
az extension add --name webapp

# Deploy from local directory
az webapp up --resource-group myResourceGroup --name gemini-chatbot-2024
```

### Option D: Deploy using ZIP

```bash
# Create a deployment package (exclude node_modules)
zip -r deploy.zip . -x "node_modules/*" ".git/*" ".env"

# Deploy using Azure CLI
az webapp deployment source config-zip \
  --resource-group myResourceGroup \
  --name gemini-chatbot-2024 \
  --src deploy.zip
```

## Step 4: Verify Deployment

1. Go to your App Service URL: `https://your-app-name.azurewebsites.net`
2. Test the health endpoint: `https://your-app-name.azurewebsites.net/health`
3. You should see: `{"status":"ok","timestamp":"..."}`

## Step 5: Configure Custom Domain (Optional)

1. In Azure Portal, go to your App Service → **Custom domains**
2. Click **Add custom domain**
3. Follow the instructions to verify your domain
4. Configure SSL certificate (free SSL available)

## Troubleshooting

### App not starting

1. Check **Log stream** in Azure Portal
2. Verify environment variables are set correctly
3. Check **Console** in Azure Portal to verify files are deployed

### Environment variables not working

1. Go to **Configuration** → **Application settings**
2. Verify `GEMINI_API_KEY` is set
3. Restart the app after adding environment variables

### Port issues

- Azure automatically sets the `PORT` environment variable
- Your `server.js` already uses `process.env.PORT || 3000`, so it should work automatically

### View logs

```bash
# Using Azure CLI
az webapp log tail --resource-group myResourceGroup --name gemini-chatbot-2024

# Or in Azure Portal: App Service → Log stream
```

## Cost Optimization

- Use **Free tier** for testing (limited resources)
- Use **Basic tier** for production (starts at ~$13/month)
- Enable **Auto-shutdown** for dev/test environments
- Use **Consumption plan** for serverless (if using Azure Functions)

## Security Best Practices

1. ✅ Never commit `.env` file to Git
2. ✅ Use Azure Key Vault for sensitive data (production)
3. ✅ Enable HTTPS only in App Service settings
4. ✅ Configure CORS properly if needed
5. ✅ Use managed identity for Azure services (advanced)

## Monitoring

1. Enable **Application Insights** for monitoring
2. Set up **Alerts** for errors and performance
3. Monitor **Metrics** in Azure Portal

## Next Steps

- Set up CI/CD pipeline (GitHub Actions, Azure DevOps)
- Configure custom domain
- Set up monitoring and alerts
- Scale up if needed

## Support

For Azure-specific issues, check:
- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Azure Support](https://azure.microsoft.com/support/)

