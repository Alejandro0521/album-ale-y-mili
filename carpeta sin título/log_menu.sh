#!/usr/bin/env zsh
# Script: log_menu.sh
# Imprime la línea de log y permite abrir archivos del directorio actual.

LOG_IP="189.233.10.12"
LOG_UA="curl/8.7.1"
LOG_LAT="19.6147"
LOG_LON="-98.9436"
LOG_CITY="Tepexpan"
LOG_URL="http://localhost:8000/?log=true"

print_log() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%S.%NZ")
  echo "$ts $LOG_IP $LOG_UA $LOG_LAT $LOG_LON $LOG_CITY $LOG_URL"
}

print_log
echo ""

# Si se pasa un archivo como argumento, lo abre directamente y sale.
if [[ -n "$1" ]]; then
  if [[ -e "$1" ]]; then
    echo "Abriendo archivo pasado como argumento: $1"
    open "$1"
    exit 0
  else
    echo "El archivo '$1' no existe. Continuando con modo interactivo..."
  fi
fi

echo "Selecciona un archivo para abrir (ENTER para salir)."
select fname in *; do
  if [[ -z "$fname" ]]; then
    echo "Saliendo."; break
  fi
  if [[ -e "$fname" ]]; then
    echo "Abriendo '$fname'..."
    open "$fname"
  else
    echo "Selección inválida."
  fi
  break
done
