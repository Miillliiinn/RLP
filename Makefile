NAME     = ML
DOCKER   ?= docker
CYAN     = \033[0;36m
GREEN    = \033[0;32m
RED      = \033[0;31m
RESET    = \033[0m
all: up
up:
	@echo "$(CYAN)Lancement de $(NAME)...$(RESET)"
	$(DOCKER) compose up --build -d
stop:
	@echo "$(RED)Arrêt des containers...$(RESET)"
	$(DOCKER) compose stop
down:
	@echo "$(RED)Suppression des containers...$(RESET)"
	$(DOCKER) compose down
fclean:
	@echo "$(RED)Nettoyage total en cours...$(RESET)"
	$(DOCKER) compose down -v
	rm -rf frontend/node_modules
	rm -rf backend/__pycache__
re: fclean all
logs:
	$(DOCKER) compose logs -f
ps:
	$(DOCKER) compose ps
.PHONY: all up stop down migrate superuser fclean re logs ps 