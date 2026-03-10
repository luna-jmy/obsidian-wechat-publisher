import { App, MarkdownView, Modal, Notice, Setting, TFile, requestUrl } from 'obsidian';
import MPPlugin from '../main';
import { markdownToHtml } from '../converter';
import { WechatPublisher } from '../publisher/wechat';

// 封面图选择模态框
export class CoverImageModal extends Modal {
	plugin: MPPlugin;
	selectedMediaId: string = '';
	onImageSelected: (mediaId: string) => void;

	constructor(app: App, plugin: MPPlugin, onImageSelected: (mediaId: string) => void) {
		super(app);
		this.plugin = plugin;
		this.onImageSelected = onImageSelected;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('wechat-cover-image-modal');

		const modalEl = (this.containerEl.querySelector('.modal') as HTMLElement);
		if (modalEl) {
			modalEl.classList.add('mod-wechat-cover');
		}

		contentEl.createEl('h2', { text: '选择封面图' });

		// 创建标签页切换
		const tabsContainer = contentEl.createDiv({ cls: 'wechat-cover-tabs' });

		// 素材库标签
		const materialTab = tabsContainer.createDiv({ cls: 'wechat-cover-tab active' });
		materialTab.textContent = '素材库';

		// 本地图片标签
		const localTab = tabsContainer.createDiv({ cls: 'wechat-cover-tab' });
		localTab.textContent = '本地图片';

		// AI 生成标签
		const aiTab = tabsContainer.createDiv({ cls: 'wechat-cover-tab' });
		aiTab.textContent = 'AI生成';

		// 内容容器
		const contentContainer = contentEl.createDiv({ cls: 'wechat-cover-content' });

		// 素材库内容
		const materialContent = contentContainer.createDiv({ cls: 'wechat-material-content' });

		// 加载中提示
		const loadingEl = materialContent.createEl('div', {
			text: '正在加载素材...',
			cls: 'wechat-material-loading'
		});

		// 创建素材网格容器
		const materialGrid = materialContent.createDiv({ cls: 'material-grid' });

		// 创建分页控制器
		const paginationContainer = materialContent.createDiv({ cls: 'pagination-container' });

		const prevButton = paginationContainer.createEl('button', { text: '上一页' });
		prevButton.disabled = true;

		const pageInfo = paginationContainer.createEl('span');
		pageInfo.textContent = '第1页';

		const nextButton = paginationContainer.createEl('button', { text: '下一页' });
		nextButton.disabled = true;

		// 本地上传内容
		const localContent = contentContainer.createDiv({ cls: 'wechat-local-content content-hidden' });

		// AI 生成内容
		const aiContent = contentContainer.createDiv({ cls: 'wechat-ai-content content-hidden' });

		// 创建文件选择按钮容器
		const fileInputContainer = localContent.createDiv({ cls: 'file-input-container' });
		const fileInput = fileInputContainer.createEl('input');
		fileInput.type = 'file';
		fileInput.accept = 'image/*';

		// 创建预览区域容器
		const imagePreviewContainer = localContent.createDiv({ cls: 'image-preview-container' });
		const imagePreview = imagePreviewContainer.createEl('div', { cls: 'image-preview' });
		imagePreview.textContent = '预览区域';

		// AI 生图：提示词 + 生成按钮
		const aiControls = aiContent.createDiv({ cls: 'ai-cover-controls' });
		const promptTextarea = aiControls.createEl('textarea', { cls: 'ai-cover-prompt' });
		promptTextarea.placeholder = '输入封面提示词（例如：极简风格、浅色背景、知识管理主题）';
		const generateButton = aiControls.createEl('button', { text: '生成', cls: 'mod-cta' });

		// AI 生图：预设标签（点击自动带入提示词）
		const tagContainer = aiContent.createDiv({ cls: 'ai-cover-tags' });
		const presets: Array<{ label: string; prompt: string }> = [
			{
				label: '风景',
				prompt: '风景封面，宁静自然，干净留白，柔和光线，适合作为公众号文章封面，现代简约，高清，细节丰富，无文字，无水印',
			},
			{
				label: '静物',
				prompt: '静物封面，桌面摆拍，柔和自然光，简洁背景，质感清晰，现代极简风，适合作为公众号文章封面，无文字，无水印',
			},
			{
				label: '人物',
				prompt: '人物封面，半身或侧脸剪影，温暖光线，背景简洁留白，现代插画/写实均可，适合作为公众号文章封面，无文字，无水印',
			},
			{
				label: '动画',
				prompt: '动画风格封面，清爽配色，现代简约，轻拟物或扁平插画，适合作为公众号文章封面，高清，细节丰富，无文字，无水印',
			},
		];

		let activeTagEl: HTMLButtonElement | null = null;
		for (const p of presets) {
			const btn = tagContainer.createEl('button', { text: p.label, cls: 'ai-cover-tag' }) as HTMLButtonElement;
			btn.type = 'button';
			btn.addEventListener('click', () => {
				promptTextarea.value = p.prompt;
				promptTextarea.focus();
				if (activeTagEl) activeTagEl.classList.remove('is-active');
				btn.classList.add('is-active');
				activeTagEl = btn;
			});
		}

		// AI 生图：裁剪预览区域（可拖动）
		const aiPreviewContainer = aiContent.createDiv({ cls: 'ai-cover-preview' });
		const aiViewport = aiPreviewContainer.createDiv({ cls: 'ai-cover-crop-viewport' });
		const aiHint = aiContent.createEl('div', {
			cls: 'ai-cover-hint',
			text: '可拖动图片调整可见范围，确认后生成 900×383 PNG 并上传为封面素材。',
		});

		// 底部按钮
		const buttonContainer = contentEl.createDiv({ cls: 'wechat-cover-buttons' });

		// 取消按钮
		const cancelButton = buttonContainer.createEl('button', { text: '取消' });

		// 素材库确认按钮
		const materialConfirmButton = buttonContainer.createEl('button', {
			text: '确认',
			cls: 'wechat-confirm-button'
		});
		materialConfirmButton.disabled = true;

		// 本地图片确认按钮
		const localConfirmButton = buttonContainer.createEl('button', {
			text: '确认',
			cls: 'wechat-confirm-button content-hidden'
		});
		localConfirmButton.disabled = true;

		// AI 生成确认按钮
		const aiConfirmButton = buttonContainer.createEl('button', {
			text: '确认',
			cls: 'wechat-confirm-button content-hidden'
		});
		aiConfirmButton.disabled = true;

		cancelButton.addEventListener('click', () => this.close());

		// 添加分页相关变量
		let currentPage = 0;
		const pageSize = 20;
		let totalCount = 0;

		// 加载素材库函数
		const loadMaterialsPage = async (page: number) => {
			try {
				materialGrid.empty();
				loadingEl.classList.add('content-visible');
				loadingEl.classList.remove('content-hidden');

				const materials = await this.plugin.wechatPublisher.getWechatMaterials(page, pageSize);

				if (materials.items.length === 0 && page === 0) {
					materialGrid.createEl('div', { text: '没有找到素材，请上传新图片' });
					return;
				}

				// 更新分页信息
				totalCount = materials.totalCount;
				currentPage = page;
				pageInfo.textContent = `第${page + 1}页 / 共${Math.ceil(totalCount / pageSize)}页`;

				// 更新分页按钮状态
				prevButton.disabled = page === 0;
				nextButton.disabled = (page + 1) * pageSize >= totalCount;

				// 加载素材项
				loadingEl.classList.add('content-hidden');
				loadingEl.classList.remove('content-visible');

				for (const material of materials.items) {
					const materialItem = materialGrid.createDiv({
						cls: 'material-item material-item-unselected'
					});

					// 添加图片
					const img = materialItem.createEl('img');
					img.src = material.url;

					// 添加素材名称
					const nameEl = materialItem.createEl('div', {
						text: material.name || '未命名素材',
						cls: 'material-item-name'
					});

					// 点击选择素材
					materialItem.addEventListener('click', () => {
						// 移除其他选中项的样式
						const items = materialGrid.querySelectorAll('.material-item');
						items.forEach((item: HTMLElement) => {
							item.classList.remove('material-item-selected');
							item.classList.add('material-item-unselected');
						});

						// 设置当前选中项的样式
						materialItem.classList.remove('material-item-unselected');
						materialItem.classList.add('material-item-selected');

						// 设置选中的media_id
						this.selectedMediaId = material.media_id;

						// 存储当前选中的素材信息
						sessionStorage.setItem('selected_material', JSON.stringify({
							media_id: material.media_id,
							url: material.url,
							name: material.name
						}));

						// 启用素材库确认按钮
						materialConfirmButton.disabled = false;
					});
				}
			} catch (error) {
				console.error('加载素材库失败:', error);
				loadingEl.textContent = '加载素材库失败，请检查网络连接';
			}
		};

		// 标签切换事件
		const setActiveTab = (tab: 'material' | 'local' | 'ai') => {
			const show = (el: HTMLElement, visible: boolean) => {
				el.classList.toggle('content-hidden', !visible);
				el.classList.toggle('content-visible', visible);
			};

			materialTab.classList.toggle('active', tab === 'material');
			localTab.classList.toggle('active', tab === 'local');
			aiTab.classList.toggle('active', tab === 'ai');

			show(materialContent, tab === 'material');
			show(localContent, tab === 'local');
			show(aiContent, tab === 'ai');

			materialConfirmButton.classList.toggle('content-hidden', tab !== 'material');
			localConfirmButton.classList.toggle('content-hidden', tab !== 'local');
			aiConfirmButton.classList.toggle('content-hidden', tab !== 'ai');

			if (tab === 'material') materialConfirmButton.disabled = true;
			if (tab === 'local') localConfirmButton.disabled = true;
			if (tab === 'ai') aiConfirmButton.disabled = !aiImageEl;
		};

		// AI 生图状态
		let aiImageEl: HTMLImageElement | null = null;
		let aiImageObjectUrl: string | null = null;
		let aiImageBlob: Blob | null = null;

		materialTab.addEventListener('click', () => setActiveTab('material'));
		localTab.addEventListener('click', () => setActiveTab('local'));
		aiTab.addEventListener('click', () => setActiveTab('ai'));

		// 文件选择事件
		let selectedFileData: ArrayBuffer | null = null;
		fileInput.addEventListener('change', (e) => {
			const target = e.target as HTMLInputElement;
			if (target.files && target.files.length > 0) {
				const selectedFile = target.files[0];

				// 读取文件数据（用于上传）
				const dataReader = new FileReader();
				dataReader.onload = (e) => {
					if (e.target && e.target.result) {
						selectedFileData = e.target.result as ArrayBuffer;
					}
				};
				dataReader.readAsArrayBuffer(selectedFile);

				// 显示预览
				const previewReader = new FileReader();
				previewReader.onload = (e) => {
					if (e.target && e.target.result) {
						imagePreview.empty();
						const img = imagePreview.createEl('img', {
							cls: 'preview-image'
						});
						img.src = e.target.result as string;

						// 保存预览图URL
						sessionStorage.setItem('preview_image_url', e.target.result as string);
					}
				};
				previewReader.readAsDataURL(selectedFile);

				// 启用本地图片确认按钮
				localConfirmButton.disabled = false;

				// 保存选中的文件
				sessionStorage.setItem('selected_file', JSON.stringify({
					name: selectedFile.name,
					type: selectedFile.type,
					size: selectedFile.size
				}));
			} else {
				imagePreview.textContent = '预览区域';
				localConfirmButton.disabled = true;
				selectedFileData = null;
				sessionStorage.removeItem('preview_image_url');
				sessionStorage.removeItem('selected_file');
			}
		});

		// AI 生图事件
		const toEndpointUrl = (baseUrl: string) => {
			const trimmed = baseUrl.trim();
			if (!trimmed) return '';

			const url = trimmed.replace(/\/+$/, '');
			if (/\/v1\/images\/generations$/i.test(url)) return url;
			if (/\/images\/generations$/i.test(url)) return url;
			// 支持用户把 Base URL 填成 .../v1（避免拼出 .../v1/v1/images/generations 导致 404）
			if (/\/v1$/i.test(url)) return `${url}/images/generations`;
			return `${url}/v1/images/generations`;
		};

		const base64ToArrayBuffer = (b64: string): ArrayBuffer => {
			const raw = atob(b64);
			const bytes = new Uint8Array(raw.length);
			for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
			return bytes.buffer;
		};

		const readBlobAsDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || ''));
			reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
			reader.readAsDataURL(blob);
		});

		const clearAiPreview = () => {
			aiViewport.empty();
			if (aiImageObjectUrl) {
				URL.revokeObjectURL(aiImageObjectUrl);
				aiImageObjectUrl = null;
			}
			aiImageEl = null;
			aiImageBlob = null;
			aiConfirmButton.disabled = true;
		};

		const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

		const setupDraggableCover = (img: HTMLImageElement) => {
			const cw = aiViewport.clientWidth;
			const ch = aiViewport.clientHeight;
			if (!cw || !ch) return;

			const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
			const w = img.naturalWidth * scale;
			const h = img.naturalHeight * scale;

			img.style.width = `${w}px`;
			img.style.height = `${h}px`;

			const applyClamp = () => {
				const left = parseFloat(img.style.left || '0');
				const top = parseFloat(img.style.top || '0');
				const minLeft = cw - w;
				const minTop = ch - h;
				img.style.left = `${clamp(left, minLeft, 0)}px`;
				img.style.top = `${clamp(top, minTop, 0)}px`;
			};

			img.style.left = `${(cw - w) / 2}px`;
			img.style.top = `${(ch - h) / 2}px`;
			applyClamp();

			let dragging = false;
			let startX = 0;
			let startY = 0;
			let startLeft = 0;
			let startTop = 0;

			img.addEventListener('pointerdown', (e) => {
				dragging = true;
				img.classList.add('dragging');
				img.setPointerCapture(e.pointerId);
				startX = e.clientX;
				startY = e.clientY;
				startLeft = parseFloat(img.style.left || '0');
				startTop = parseFloat(img.style.top || '0');
			});

			img.addEventListener('pointermove', (e) => {
				if (!dragging) return;
				const dx = e.clientX - startX;
				const dy = e.clientY - startY;
				img.style.left = `${startLeft + dx}px`;
				img.style.top = `${startTop + dy}px`;
				applyClamp();
			});

			const stopDrag = () => {
				dragging = false;
				img.classList.remove('dragging');
			};

			img.addEventListener('pointerup', stopDrag);
			img.addEventListener('pointercancel', stopDrag);
		};

		const setAiImageBlob = async (blob: Blob) => {
			clearAiPreview();
			aiImageBlob = blob;
			aiImageObjectUrl = URL.createObjectURL(blob);

			const img = aiViewport.createEl('img', { cls: 'ai-cover-image' });
			img.draggable = false;
			img.src = aiImageObjectUrl;

			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('图片加载失败'));
			});

			aiImageEl = img;
			requestAnimationFrame(() => {
				requestAnimationFrame(() => setupDraggableCover(img));
			});

			aiConfirmButton.disabled = false;
		};

		generateButton.addEventListener('click', async () => {
			const prompt = promptTextarea.value.trim();
			if (!prompt) {
				new Notice('请输入提示词');
				return;
			}

			const settings = this.plugin.settingsManager.getSettings();
			const endpoint = toEndpointUrl(settings.aiImageApiBaseUrl || '');
			if (!endpoint) {
				new Notice('请先在插件设置里填写 AI 生图 API 地址');
				return;
			}
			if (!settings.aiImageApiKey) {
				new Notice('请先在插件设置里填写 AI 生图 API 密钥');
				return;
			}
			if (!settings.aiImageModel) {
				new Notice('请先在插件设置里填写生图模型');
				return;
			}

			try {
				generateButton.disabled = true;
				generateButton.textContent = '生成中...';
				clearAiPreview();

				// 兼容 OpenAI Images API 与硅基流动（image_size / batch_size）
				const modelName = settings.aiImageModel;
				const imageSize = /qwen[-_/ ]?image/i.test(modelName) ? '1328x1328' : '1024x1024';

				const resp = await requestUrl({
					url: endpoint,
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${settings.aiImageApiKey}`,
					},
					body: JSON.stringify({
						model: modelName,
						prompt,
						n: 1,
						size: imageSize,
						response_format: 'b64_json',
						image_size: imageSize,
						batch_size: 1,
					}),
				});

				const openAiData0 = resp.json?.data?.[0] ?? null;
				const siliconFlowUrl = resp.json?.images?.[0]?.url ?? null;

				if (openAiData0?.b64_json) {
					const buf = base64ToArrayBuffer(String(openAiData0.b64_json));
					await setAiImageBlob(new Blob([buf], { type: 'image/png' }));
				} else if (openAiData0?.url) {
					const imageResp = await requestUrl({ url: String(openAiData0.url), method: 'GET' });
					const contentType = (imageResp.headers?.['content-type'] as string) || 'image/png';
					await setAiImageBlob(new Blob([imageResp.arrayBuffer], { type: contentType }));
				} else if (siliconFlowUrl) {
					const imageResp = await requestUrl({ url: String(siliconFlowUrl), method: 'GET' });
					const contentType = (imageResp.headers?.['content-type'] as string) || 'image/png';
					await setAiImageBlob(new Blob([imageResp.arrayBuffer], { type: contentType }));
				} else {
					throw new Error('No image returned. Expected data[0].b64_json / data[0].url / images[0].url.');
				}

				// 如果用户不在 AI 标签页，生成完成后自动切换过去
				if (!aiTab.classList.contains('active')) {
					setActiveTab('ai');
				}
			} catch (error: any) {
				console.error('AI 生图失败:', error);
				const msg = String(error?.message || '未知错误');
				if (msg.includes('status 404')) {
					new Notice(`AI 生图失败（404）：请检查「API 地址」是否填成了 .../v1（建议填 Base URL 或完整 /v1/images/generations）。当前请求：${endpoint}`);
				} else {
					new Notice('AI 生图失败：' + msg);
				}
			} finally {
				generateButton.disabled = false;
				generateButton.textContent = '生成';
			}
		});

		aiConfirmButton.addEventListener('click', async () => {
			if (!aiImageEl || !aiImageBlob) {
				new Notice('请先生成封面图');
				return;
			}

			const cw = aiViewport.clientWidth;
			const ch = aiViewport.clientHeight;
			if (!cw || !ch) {
				new Notice('裁剪区域尺寸异常，请重试');
				return;
			}

			const outW = 900;
			const outH = 383;
			const factor = outW / cw;

			const imgLeft = parseFloat(aiImageEl.style.left || '0') * factor;
			const imgTop = parseFloat(aiImageEl.style.top || '0') * factor;
			const imgW = parseFloat(aiImageEl.style.width || '0') * factor;
			const imgH = parseFloat(aiImageEl.style.height || '0') * factor;

			const canvas = document.createElement('canvas');
			canvas.width = outW;
			canvas.height = outH;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				new Notice('无法创建画布，请重试');
				return;
			}

			ctx.drawImage(aiImageEl, imgLeft, imgTop, imgW, imgH);

			const pngBlob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((b) => b ? resolve(b) : reject(new Error('生成 PNG 失败')), 'image/png');
			});

			const fileName = `cover_${Date.now()}.png`;
			const pngArrayBuffer = await pngBlob.arrayBuffer();

			try {
				aiConfirmButton.disabled = true;
				aiConfirmButton.textContent = '正在上传...';

				const mediaId = await this.plugin.wechatPublisher.uploadImageToWechat(pngArrayBuffer, fileName);
				if (!mediaId) {
					new Notice('上传封面图失败，请重试');
					return;
				}

				const previewUrl = await readBlobAsDataUrl(pngBlob);
				sessionStorage.setItem('selected_material', JSON.stringify({
					media_id: mediaId,
					url: previewUrl,
					name: fileName,
					isLocal: false,
				}));

				this.onImageSelected(mediaId);
				new Notice('封面图生成并上传成功');
				this.close();
			} catch (error: any) {
				console.error('上传 AI 封面失败:', error);
				new Notice('上传 AI 封面失败：' + (error?.message || '未知错误'));
			} finally {
				aiConfirmButton.disabled = false;
				aiConfirmButton.textContent = '确认';
			}
		});

		// 素材库确认按钮事件
		materialConfirmButton.addEventListener('click', () => {
			const selectedMaterial = sessionStorage.getItem('selected_material');
			if (!selectedMaterial) {
				new Notice('请先选择图片');
				return;
			}
			const material = JSON.parse(selectedMaterial);
			this.onImageSelected(material.media_id);
			this.close();
		});

		// 本地图片确认按钮事件
		localConfirmButton.addEventListener('click', async () => {
			const selectedFileInfo = sessionStorage.getItem('selected_file');
			const previewImageUrl = sessionStorage.getItem('preview_image_url');

			if (!selectedFileInfo || !previewImageUrl || !selectedFileData) {
				new Notice('请先选择图片');
				return;
			}

			const fileInfo = JSON.parse(selectedFileInfo);

			// 立即上传图片到微信获取 media_id
			localConfirmButton.disabled = true;
			localConfirmButton.textContent = '正在上传...';

			try {
				const mediaId = await this.plugin.wechatPublisher.uploadImageToWechat(
					selectedFileData,
					fileInfo.name
				);

				if (!mediaId) {
					new Notice('上传封面图失败，请重试');
					localConfirmButton.disabled = false;
					localConfirmButton.textContent = '确认';
					return;
				}

				// 保存上传成功的图片信息
				sessionStorage.setItem('selected_material', JSON.stringify({
					media_id: mediaId,
					url: previewImageUrl,
					name: fileInfo.name,
					isLocal: false  // 已经上传到微信，不再是本地图片
				}));

				this.onImageSelected(mediaId);
				new Notice('封面图上传成功');
				this.close();
			} catch (error) {
				console.error('上传封面图失败:', error);
				new Notice('上传封面图失败：' + (error.message || '未知错误'));
				localConfirmButton.disabled = false;
				localConfirmButton.textContent = '确认';
			}
		});

		// 分页按钮事件
		prevButton.addEventListener('click', () => {
			if (currentPage > 0) {
				loadMaterialsPage(currentPage - 1);
			}
		});

		nextButton.addEventListener('click', () => {
			if ((currentPage + 1) * pageSize < totalCount) {
				loadMaterialsPage(currentPage + 1);
			}
		});

		// 初始化加载第一页
		await loadMaterialsPage(0);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// 发布模态框
export class PublishModal extends Modal {
	plugin: MPPlugin;
	markdownView: MarkdownView;
	titleInput: HTMLInputElement;
	platformSelect: HTMLSelectElement;
	coverImagePreview: HTMLElement;
	selectedCoverMediaId: string = '';

	constructor(app: App, plugin: MPPlugin, markdownView: MarkdownView) {
		super(app);
		this.plugin = plugin;
		this.markdownView = markdownView;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// 添加相同的处理
		const modalEl = (this.containerEl.querySelector('.modal') as HTMLElement);
		if (modalEl) {
			modalEl.classList.add('mod-publish');
		}

		contentEl.createEl('h2', { text: '发布到内容平台' });

		// 标题输入
		const titleSetting = new Setting(contentEl)
			.setName('标题')
			.setDesc('文章标题');

		this.titleInput = document.createElement('input');
		this.titleInput.type = 'text';
		this.titleInput.value = this.markdownView.file?.basename || '';
		this.titleInput.className = 'full-width-input';

		titleSetting.controlEl.appendChild(this.titleInput);

		// 平台选择
		const platformSetting = new Setting(contentEl)
			.setName('平台')
			.setDesc('选择发布平台');

		this.platformSelect = document.createElement('select');
		this.platformSelect.className = 'enhanced-publisher-platform-selector';

		const wechatOption = document.createElement('option');
		wechatOption.value = 'wechat';
		wechatOption.text = '微信公众号';
		this.platformSelect.appendChild(wechatOption);

		// 未来可以添加更多平台选项

		platformSetting.controlEl.appendChild(this.platformSelect);

		// 添加草稿复选框
		const draftSetting = new Setting(contentEl)
			.setName('草稿')
			.setDesc('当前仅支持保存到草稿箱，后续将支持直接发布');

		const draftCheckbox = document.createElement('input');
		draftCheckbox.type = 'checkbox';
		draftCheckbox.checked = true;
		draftCheckbox.disabled = true;
		draftSetting.controlEl.appendChild(draftCheckbox);

		// 封面图选择（仅对微信公众号显示）
		const coverImageSetting = new Setting(contentEl)
			.setName('封面图')
			.setDesc('选择文章封面图');

		// 创建封面图选择区域的容器
		const coverImageContainer = document.createElement('div');
		coverImageContainer.className = 'cover-container';

		// 封面图预览区域
		this.coverImagePreview = document.createElement('div');
		this.coverImagePreview.className = 'cover-preview';
		this.coverImagePreview.textContent = '无封面图';

		// 选择按钮
		const selectCoverButton = document.createElement('button');
		selectCoverButton.className = 'mod-cta';
		selectCoverButton.textContent = '选择封面图';
		selectCoverButton.addEventListener('click', () => {
			// 打开封面图选择模态框
			const coverImageModal = new CoverImageModal(this.app, this.plugin, (mediaId) => {
				this.selectedCoverMediaId = mediaId;

				// 更新预览区域
				this.coverImagePreview.empty();
				const img = document.createElement('img') as HTMLImageElement;
				img.className = 'preview-image';

				// 从sessionStorage获取选中的素材信息
				const selectedMaterial = sessionStorage.getItem('selected_material');
				if (selectedMaterial) {
					const material = JSON.parse(selectedMaterial);
					if (material.url) {
						img.src = material.url;
						this.coverImagePreview.appendChild(img);
					} else {
						this.coverImagePreview.textContent = '已选择封面图';
					}
				} else {
					this.coverImagePreview.textContent = '已选择封面图';
				}
			});
			coverImageModal.open();
		});

		coverImageContainer.appendChild(this.coverImagePreview);
		coverImageContainer.appendChild(selectCoverButton);

		coverImageSetting.controlEl.appendChild(coverImageContainer);

		// 创建发布按钮容器并居中
		const publishButtonContainer = contentEl.createDiv({
			cls: 'publish-button-container'
		});

		// 发布按钮
		const publishButton = publishButtonContainer.createEl('button', {
			text: '发布',
			cls: 'enhanced-publisher-publish-button'
		});

		publishButton.addEventListener('click', async () => {
			const title = this.titleInput.value;
			const platform = this.platformSelect.value;

			if (!title) {
				new Notice('请输入标题');
				return;
			}

			if (platform === 'wechat' && !this.coverImagePreview.querySelector('img')) {
				new Notice('请选择封面图');
				return;
			}

			if (!this.markdownView.file) {
				new Notice('无法获取当前文件');
				return;
			}

			// 使用 markdownToHtml 渲染内容（通过 juice 内联 CSS，确保样式在公众号后台正确显示）
			const content = this.markdownView.getViewData();
			const htmlContent = await markdownToHtml(
				this.app,
				content,
				this.markdownView.file?.path || '',
				this.plugin.themeManager,
			);

			if (platform === 'wechat') {
				if (!this.plugin.settings.wechatAppId || !this.plugin.settings.wechatAppSecret) {
					new Notice('请先在设置中配置微信公众号的AppID和AppSecret');
					return;
				}

				// 检查是否选择了封面图
				if (!this.selectedCoverMediaId) {
					new Notice('请先选择封面图');
					return;
				}

				try {
					// 获取选中的封面图 media_id
					const selectedMaterial = sessionStorage.getItem('selected_material');
					if (selectedMaterial) {
						const material = JSON.parse(selectedMaterial);
						this.selectedCoverMediaId = material.media_id;
					}

					// 再次检查 media_id 是否有效
					if (!this.selectedCoverMediaId) {
						new Notice('封面图 media_id 无效，请重新选择封面图');
						return;
					}

					publishButton.textContent = '正在发布...';
					const success = await this.plugin.publishToWechat(
						title,
						htmlContent,
						this.selectedCoverMediaId,
						this.markdownView.file
					);

					if (success) {
						this.close();
					}
				} catch (error) {
					console.error('发布失败:', error);
					new Notice('发布失败：' + (error.message || '未知错误'));
					publishButton.disabled = false;
					publishButton.textContent = '发布';
				}
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
} 
